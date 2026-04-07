package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/anthropics/anthropic-sdk-go"
)

const maxToolIterations = 10

type Agent struct {
	client *anthropic.Client
	tools  []ToolDefinition
	model  string
}

func NewAgent(client *anthropic.Client, tools []ToolDefinition) *Agent {
	return &Agent{
		client: client,
		tools:  tools,
		model:  "claude-sonnet-4-6",
	}
}

// Run executes the agent loop for a single user turn and writes the final
// assistant text to w. It returns the full assistant text.
func (a *Agent) Run(ctx context.Context, toolCtx ToolContext, system string, messages []anthropic.MessageParam, w io.Writer) (string, error) {
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
			Model:     a.model,
			MaxTokens: 2048,
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
