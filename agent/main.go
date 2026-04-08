package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/joho/godotenv"
)

type ChatRequest struct {
	ProjectID   string           `json:"project_id"`
	Message     string           `json:"message"`
	History     []HistoryMessage `json:"history"`
	AuthToken   string           `json:"auth_token"`
	BaseURL     string           `json:"base_url"`
	GitHubRepos []string         `json:"github_repos"`
	IsOwner     bool             `json:"is_owner"`
}

type HistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func buildSystemPrompt(isOwner bool, linkedRepos []string) string {
	ownerSection := ""
	if isOwner {
		ownerSection = `
## Owner capabilities
You are talking to the project owner. You can edit project details using update_project.

CRITICAL distinction — two completely separate actions:
- update_project  → edits the project record (title, summary, status, skills, repos, Notion URL). Use when the user says "update the summary", "change the status", "add a skill", "edit the project", etc.
- post_update     → appends a new entry to the activity feed visible to all members. Only use this when the user explicitly asks to "post an update", "share an update", "announce", or similar.

NEVER use post_update when the user means to edit project fields. If the intent is ambiguous, ask — but it usually isn't.
`
	} else {
		ownerSection = `
## Permissions
You are talking to a contributor (not the owner). You cannot edit project details or post updates on their behalf. Focus on reading context, answering questions, and managing tasks you are assigned.
`
	}

	repoSection := "\n## Linked repositories\n- No repositories are currently linked to this project.\n"
	if len(linkedRepos) > 0 {
		repoSection = "\n## Linked repositories\n"
		for _, repo := range linkedRepos {
			repoSection += fmt.Sprintf("- %s\n", repo)
		}
	}

	return `You are a project agent for OC Labs. You help team members manage their project by reading context, writing updates, creating context blocks, decomposing work into tasks, and reading linked repositories.

## Personality
- Be extremely brief. No filler, no pleasantries.
- Lead with the answer or action, not reasoning.
- Surface open questions when fields need clarification.
- For small actions (posting an update, creating a context block): ask clarifying questions if needed, then execute.
- For larger actions (task decomposition, multi-step plans): propose a numbered plan and wait for the user to confirm before executing.

## Safety
- You can only interact with the project you are scoped to.
- All writes go through the OC Labs API with the user's auth — you cannot escalate privileges.
- Never fabricate data. If you don't know something, say so.
- When creating tasks, set realistic scope — prefer more small tasks over fewer large ones.

## Tools
Only fetch project data when the user's request requires it. Before creating new context blocks or tasks, check for existing ones to avoid duplicates.

For repository work:
- Use list_repo_files to discover paths when the user asks to inspect a repo or you do not know exact filenames yet.
- Use read_repo_file after you have a path (or when the user gives a direct path).
- If the user asks you to remember/add/remove linked repositories for future chats, use update_project with github_repos.` + repoSection + ownerSection
}

func main() {
	// Load .env if present (ignored in production where env vars are set directly)
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	client := anthropic.NewClient()

	tools := []ToolDefinition{
		GetProjectContextDef,
		GetTasksDef,
		ListRepoFilesDef,
		ReadRepoFileDef,
		UpdateProjectDef,
		PostUpdateDef,
		CreateContextBlockDef,
		CreateTasksDef,
		UpdateTaskDef,
		DeleteTaskDef,
	}

	agent := NewAgent(&client, tools)

	http.HandleFunc("POST /chat", func(w http.ResponseWriter, r *http.Request) {
		handleChat(r.Context(), agent, w, r)
	})

	log.Printf("agent listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func handleChat(ctx context.Context, agent *Agent, w http.ResponseWriter, r *http.Request) {
	log.Printf("POST /chat from %s", r.RemoteAddr)
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("bad request: %v", err)
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	if req.ProjectID == "" || req.Message == "" {
		http.Error(w, `{"error":"project_id and message are required"}`, http.StatusBadRequest)
		return
	}

	toolCtx := ToolContext{
		ProjectID:   req.ProjectID,
		BaseURL:     req.BaseURL,
		AuthToken:   req.AuthToken,
		GitHubRepos: req.GitHubRepos,
		IsOwner:     req.IsOwner,
	}

	// Build message history
	var messages []anthropic.MessageParam
	for _, m := range req.History {
		messages = append(messages, anthropic.MessageParam{
			Role: anthropic.MessageParamRole(m.Role),
			Content: []anthropic.ContentBlockParamUnion{
				{OfText: &anthropic.TextBlockParam{Text: m.Content}},
			},
		})
	}
	// Append current user message
	messages = append(messages, anthropic.MessageParam{
		Role: "user",
		Content: []anthropic.ContentBlockParamUnion{
			{OfText: &anthropic.TextBlockParam{Text: req.Message}},
		},
	})

	// Stream response
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Transfer-Encoding", "chunked")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	flusher, ok := w.(http.Flusher)

	log.Printf("running agent for project=%s is_owner=%v linked_repos=%d", req.ProjectID, req.IsOwner, len(req.GitHubRepos))
	_, err := agent.Run(
		ctx,
		toolCtx,
		buildSystemPrompt(req.IsOwner, req.GitHubRepos),
		messages,
		&flushWriter{w: w, f: flusher, ok: ok},
	)
	if err != nil {
		log.Printf("agent error project=%s: %v", req.ProjectID, err)
		// If headers already sent, we can't change status code
		fmt.Fprintf(w, "\n\n[agent error: %s]", err.Error())
	}
}

// flushWriter wraps http.ResponseWriter to flush after each write.
type flushWriter struct {
	w  http.ResponseWriter
	f  http.Flusher
	ok bool
}

func (fw *flushWriter) Write(p []byte) (int, error) {
	n, err := fw.w.Write(p)
	if fw.ok {
		fw.f.Flush()
	}
	return n, err
}
