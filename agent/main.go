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
}

type HistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

const systemPrompt = `You are a project agent for OC Labs. You help team members manage their project by reading context, writing updates, creating context blocks, decomposing work into tasks, and reading linked repositories.

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
Use your tools to read project state before acting. Always check existing context and tasks before creating duplicates.`

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
		ReadRepoFileDef,
		PostUpdateDef,
		CreateContextBlockDef,
		CreateTasksDef,
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

	log.Printf("running agent for project=%s", req.ProjectID)
	_, err := agent.Run(ctx, toolCtx, systemPrompt, messages, &flushWriter{w: w, f: flusher, ok: ok})
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
