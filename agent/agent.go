package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
)

const maxToolIterations = 6
const (
	defaultGeneralModel  = "claude-sonnet-4-6"
	defaultRepoReadModel = "claude-sonnet-4-5"
)

type Agent struct {
	client        *anthropic.Client
	tools         []ToolDefinition
	generalModel  string
	repoReadModel string
}

func NewAgent(client *anthropic.Client, tools []ToolDefinition) *Agent {
	return &Agent{
		client:        client,
		tools:         tools,
		generalModel:  firstNonEmpty(strings.TrimSpace(os.Getenv("AGENT_MODEL_GENERAL")), defaultGeneralModel),
		repoReadModel: firstNonEmpty(strings.TrimSpace(os.Getenv("AGENT_MODEL_REPO_READ")), defaultRepoReadModel),
	}
}

// Run executes the agent loop for a single user turn and writes the final
// assistant text to w. It returns the full assistant text.
func (a *Agent) Run(
	ctx context.Context,
	toolCtx ToolContext,
	system string,
	userMessage string,
	messages []anthropic.MessageParam,
	w io.Writer,
) (string, error) {
	model, routeReason := a.selectModel(userMessage)
	log.Printf("agent model route=%s model=%s", routeReason, model)

	output, err := a.runWithModel(ctx, toolCtx, system, messages, model, w)
	if err == nil {
		return output, nil
	}

	if model != a.generalModel && isModelSelectionError(err) {
		log.Printf("agent model fallback model=%s reason=%v", a.generalModel, err)
		return a.runWithModel(ctx, toolCtx, system, messages, a.generalModel, w)
	}

	return "", err
}

func (a *Agent) runWithModel(
	ctx context.Context,
	toolCtx ToolContext,
	system string,
	messages []anthropic.MessageParam,
	model string,
	w io.Writer,
) (string, error) {
	// Build tool params
	anthropicTools := make([]anthropic.ToolUnionParam, len(a.tools))
	for i, tool := range a.tools {
		anthropicTools[i] = anthropic.ToolUnionParam{
			OfTool: &anthropic.ToolParam{
				Name:        tool.Name,
				Description: anthropic.String(tool.Description),
				InputSchema: tool.InputSchema,
			},
		}
	}

	for range maxToolIterations {
		message, err := a.client.Messages.New(ctx, anthropic.MessageNewParams{
			Model:     model,
			MaxTokens: 1536,
			System:    []anthropic.TextBlockParam{{Text: system}},
			Messages:  messages,
			Tools:     anthropicTools,
		})
		if err != nil {
			return "", fmt.Errorf("inference: %w", err)
		}

		// Append assistant message to conversation
		messages = append(messages, message.ToParam())

		// Collect tool results
		var toolResults []anthropic.ContentBlockParamUnion
		var lastText string

		for _, block := range message.Content {
			switch block.Type {
			case "text":
				lastText = block.Text
			case "tool_use":
				result := a.executeTool(toolCtx, block.ID, block.Name, block.Input)
				toolResults = append(toolResults, result)
			}
		}

		// If no tool calls, we're done — write the final text
		if len(toolResults) == 0 {
			if w != nil && lastText != "" {
				io.WriteString(w, lastText)
			}
			return lastText, nil
		}

		// Feed tool results back as a user message
		messages = append(messages, anthropic.MessageParam{
			Role:    "user",
			Content: toolResults,
		})
	}

	return "", fmt.Errorf("agent exceeded %d tool iterations", maxToolIterations)
}

func (a *Agent) selectModel(userMessage string) (model string, reason string) {
	message := strings.ToLower(strings.TrimSpace(userMessage))
	if message == "" {
		return a.generalModel, "default"
	}

	if looksLikeRepoReadIntent(message) {
		return a.repoReadModel, "repo_read"
	}

	return a.generalModel, "default"
}

func looksLikeRepoReadIntent(message string) bool {
	repoKeywords := []string{
		"repo",
		"repository",
		"repositories",
		"codebase",
		"readme",
		"source code",
		"inspect code",
		"analyze code",
		"list files",
		"read file",
		"folder",
		"directory",
		"path",
		"github",
		"commit",
		"commits",
		"deployment",
		"deployments",
		"diff",
		"pr ",
		"pull request",
		"bug in",
		"refactor",
		"where is",
		"which file",
	}

	for _, keyword := range repoKeywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

func isModelSelectionError(err error) bool {
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "invalid model") ||
		strings.Contains(lower, "unknown model") ||
		strings.Contains(lower, "unsupported model") ||
		(strings.Contains(lower, "model") && strings.Contains(lower, "not found")) ||
		strings.Contains(lower, "must be one of")
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func (a *Agent) executeTool(toolCtx ToolContext, id, name string, input json.RawMessage) anthropic.ContentBlockParamUnion {
	for _, tool := range a.tools {
		if tool.Name == name {
			result, err := tool.Function(toolCtx, input)
			if err != nil {
				return anthropic.ContentBlockParamUnion{
					OfToolResult: &anthropic.ToolResultBlockParam{
						ToolUseID: id,
						Content:   []anthropic.ToolResultBlockParamContentUnion{{OfText: &anthropic.TextBlockParam{Text: fmt.Sprintf("error: %s", err.Error())}}},
						IsError:   anthropic.Bool(true),
					},
				}
			}
			return anthropic.ContentBlockParamUnion{
				OfToolResult: &anthropic.ToolResultBlockParam{
					ToolUseID: id,
					Content:   []anthropic.ToolResultBlockParamContentUnion{{OfText: &anthropic.TextBlockParam{Text: result}}},
				},
			}
		}
	}
	return anthropic.ContentBlockParamUnion{
		OfToolResult: &anthropic.ToolResultBlockParam{
			ToolUseID: id,
			Content:   []anthropic.ToolResultBlockParamContentUnion{{OfText: &anthropic.TextBlockParam{Text: "error: unknown tool"}}},
			IsError:   anthropic.Bool(true),
		},
	}
}
