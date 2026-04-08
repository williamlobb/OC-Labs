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
	Body       string `json:"body" jsonschema_description:"The update text to post"`
	Milestone  bool   `json:"milestone" jsonschema_description:"Whether this is a milestone update"`
	AuthorName string `json:"author_name" jsonschema_description:"Display name of the author"`
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

// doRequest performs an HTTP request to the OC Labs API with auth and an optional JSON body.
// method should be http.MethodPost, http.MethodPatch, http.MethodDelete, etc.
// payload may be nil for requests with no body (e.g. DELETE).
// Returns the response body as a string. On non-2xx status it returns an error.
func doRequest(ctx ToolContext, method, url string, payload any) (string, error) {
	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return "", fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
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

// doPost is a convenience wrapper around doRequest for POST calls.
func doPost(ctx ToolContext, url string, payload any) (string, error) {
	return doRequest(ctx, http.MethodPost, url, payload)
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

		params.AuthorName = "Omnia Agent"
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

// UpdateTaskInput is the input schema for the update_task tool.
// All fields except task_id are optional; only supplied fields are updated.
type UpdateTaskInput struct {
	TaskID           string   `json:"task_id" jsonschema_description:"ID of the task to update"`
	Title            string   `json:"title,omitempty" jsonschema_description:"New title (non-empty string)"`
	Body             string   `json:"body,omitempty" jsonschema_description:"New description body (empty string clears it)"`
	Status           string   `json:"status,omitempty" jsonschema_description:"New status: todo | in_progress | done | blocked"`
	AssigneeID       string   `json:"assignee_id,omitempty" jsonschema_description:"User ID to assign, or empty string to unassign"`
	AssignedToAgent  *bool    `json:"assigned_to_agent,omitempty" jsonschema_description:"Whether the task is assigned to the agent"`
	DependsOn        []string `json:"depends_on,omitempty" jsonschema_description:"Ordered list of task IDs this task depends on (replaces existing list)"`
}

// UpdateTaskDef updates a single task via PATCH.
var UpdateTaskDef = ToolDefinition{
	Name:        "update_task",
	Description: "Update a task's title, body, status, assignee, agent flag, or dependencies. Only include fields you want to change. Use get_tasks first to find the task ID.",
	InputSchema: GenerateSchema[UpdateTaskInput](),
	Function: func(ctx ToolContext, input json.RawMessage) (string, error) {
		var params UpdateTaskInput
		if err := json.Unmarshal(input, &params); err != nil {
			return "", fmt.Errorf("parse input: %w", err)
		}
		if params.TaskID == "" {
			return "", fmt.Errorf("task_id is required")
		}

		// Build a map of only the fields that were supplied
		updates := map[string]any{}
		if params.Title != "" {
			updates["title"] = params.Title
		}
		if params.Body != "" {
			updates["body"] = params.Body
		}
		if params.Status != "" {
			updates["status"] = params.Status
		}
		if params.AssigneeID != "" {
			updates["assignee_id"] = params.AssigneeID
		}
		if params.AssignedToAgent != nil {
			updates["assigned_to_agent"] = *params.AssignedToAgent
		}
		if params.DependsOn != nil {
			updates["depends_on"] = params.DependsOn
		}

		url := fmt.Sprintf("%s/api/v1/projects/%s/tasks/%s", ctx.BaseURL, ctx.ProjectID, params.TaskID)
		_, err := doRequest(ctx, http.MethodPatch, url, updates)
		if err != nil {
			return "", err
		}

		return fmt.Sprintf("Task %s updated.", params.TaskID), nil
	},
}

// DeleteTaskInput is the input schema for the delete_task tool.
type DeleteTaskInput struct {
	TaskID string `json:"task_id" jsonschema_description:"ID of the task to delete"`
}

// DeleteTaskDef deletes a single task via DELETE.
var DeleteTaskDef = ToolDefinition{
	Name:        "delete_task",
	Description: "Permanently delete a task. Use get_tasks first to confirm the task ID. Only call this when the user explicitly asks to delete or remove a task.",
	InputSchema: GenerateSchema[DeleteTaskInput](),
	Function: func(ctx ToolContext, input json.RawMessage) (string, error) {
		var params DeleteTaskInput
		if err := json.Unmarshal(input, &params); err != nil {
			return "", fmt.Errorf("parse input: %w", err)
		}
		if params.TaskID == "" {
			return "", fmt.Errorf("task_id is required")
		}

		url := fmt.Sprintf("%s/api/v1/projects/%s/tasks/%s", ctx.BaseURL, ctx.ProjectID, params.TaskID)
		_, err := doRequest(ctx, http.MethodDelete, url, nil)
		if err != nil {
			return "", err
		}

		return fmt.Sprintf("Task %s deleted.", params.TaskID), nil
	},
}
