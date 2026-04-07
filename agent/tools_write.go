package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// PostUpdateInput is the input schema for the post_update tool.
type PostUpdateInput struct {
	Body      string `json:"body" jsonschema_description:"The update text to post"`
	Milestone bool   `json:"milestone" jsonschema_description:"Whether this is a milestone update"`
}

// CreateContextBlockInput is the input schema for the create_context_block tool.
type CreateContextBlockInput struct {
	Title     string `json:"title" jsonschema_description:"Short title for the context block"`
	Body      string `json:"body" jsonschema_description:"Detailed description or content"`
	BlockType string `json:"block_type" jsonschema_description:"One of: general, architecture, decision, constraint"`
}

// CreateTasksInput is the input schema for the create_tasks tool.
type CreateTasksInput struct {
	Tasks []TaskInput `json:"tasks" jsonschema_description:"List of tasks to create"`
}

// TaskInput represents a single task to create.
type TaskInput struct {
	Title string `json:"title" jsonschema_description:"Task title — clear, actionable, specific"`
	Body  string `json:"body,omitempty" jsonschema_description:"Optional task details"`
}

// doPost performs a POST request to the OC Labs API with auth and JSON body.
// It returns the response body as a string. On non-2xx status it returns the
// response body as an error string so callers can surface it to the agent.
func doPost(ctx ToolContext, url string, payload any) (string, error) {
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal request body: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Cookie", fmt.Sprintf("sb-lmhntrqbxrzltppafjnu-auth-token=%s", ctx.AuthToken))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	return string(respBody), nil
}

// PostUpdateTool posts a project update to the OC Labs API.
var PostUpdateDef = ToolDefinition{
	Name:        "post_update",
	Description: "Post a project update. Use for status changes, progress notes, or milestone announcements.",
	InputSchema: GenerateSchema[PostUpdateInput](),
	Function: func(ctx ToolContext, input json.RawMessage) (string, error) {
		var params PostUpdateInput
		if err := json.Unmarshal(input, &params); err != nil {
			return "", fmt.Errorf("parse input: %w", err)
		}

		url := fmt.Sprintf("%s/api/v1/projects/%s/updates", ctx.BaseURL, ctx.ProjectID)
		_, err := doPost(ctx, url, params)
		if err != nil {
			return "", err
		}

		updateType := "update"
		if params.Milestone {
			updateType = "milestone update"
		}
		return fmt.Sprintf("Posted %s successfully.", updateType), nil
	},
}

// CreateContextBlockTool creates a context block for the project.
var CreateContextBlockDef = ToolDefinition{
	Name:        "create_context_block",
	Description: "Create a context block to document project knowledge. Use 'architecture' for technical design, 'decision' for choices made, 'constraint' for limitations, 'general' for everything else.",
	InputSchema: GenerateSchema[CreateContextBlockInput](),
	Function: func(ctx ToolContext, input json.RawMessage) (string, error) {
		var params CreateContextBlockInput
		if err := json.Unmarshal(input, &params); err != nil {
			return "", fmt.Errorf("parse input: %w", err)
		}

		url := fmt.Sprintf("%s/api/v1/projects/%s/context", ctx.BaseURL, ctx.ProjectID)
		_, err := doPost(ctx, url, params)
		if err != nil {
			return "", err
		}

		return fmt.Sprintf("Created context block '%s' (type: %s).", params.Title, params.BlockType), nil
	},
}

// CreateTasksTool creates multiple tasks for the project sequentially.
var CreateTasksDef = ToolDefinition{
	Name:        "create_tasks",
	Description: "Create multiple tasks for the project plan. Each task should be small, specific, and actionable. The user should review these before syncing to Jira.",
	InputSchema: GenerateSchema[CreateTasksInput](),
	Function: func(ctx ToolContext, input json.RawMessage) (string, error) {
		var params CreateTasksInput
		if err := json.Unmarshal(input, &params); err != nil {
			return "", fmt.Errorf("parse input: %w", err)
		}

		url := fmt.Sprintf("%s/api/v1/projects/%s/tasks", ctx.BaseURL, ctx.ProjectID)

		var createdTitles []string
		var failures []string

		for _, task := range params.Tasks {
			_, err := doPost(ctx, url, task)
			if err != nil {
				failures = append(failures, fmt.Sprintf("'%s': %s", task.Title, err.Error()))
				continue
			}
			createdTitles = append(createdTitles, fmt.Sprintf("'%s'", task.Title))
		}

		var parts []string
		if len(createdTitles) > 0 {
			parts = append(parts, fmt.Sprintf("Created %d task(s): %s", len(createdTitles), strings.Join(createdTitles, ", ")))
		}
		if len(failures) > 0 {
			parts = append(parts, fmt.Sprintf("Failed to create %d task(s): %s", len(failures), strings.Join(failures, "; ")))
		}

		return strings.Join(parts, ". "), nil
	},
}
