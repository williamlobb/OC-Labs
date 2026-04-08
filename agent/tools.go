package main

import (
	"encoding/json"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/invopop/jsonschema"
)

type ToolDefinition struct {
	Name        string
	Description string
	InputSchema anthropic.ToolInputSchemaParam
	Function    func(ctx ToolContext, input json.RawMessage) (string, error)
}

// ToolContext carries per-request state so tools can call the OC Labs API
// on behalf of the authenticated user.
type ToolContext struct {
	ProjectID   string
	BaseURL     string   // e.g. "https://oclabs.space" or "http://localhost:3000"
	AuthToken   string   // user's session cookie or bearer token
	GitHubRepos []string // repo URLs from the project
	IsOwner     bool     // whether the current user is the project owner
}

func GenerateSchema[T any]() anthropic.ToolInputSchemaParam {
	reflector := jsonschema.Reflector{
		AllowAdditionalProperties: false,
		DoNotReference:            true,
	}
	var v T
	schema := reflector.Reflect(v)
	return anthropic.ToolInputSchemaParam{
		Properties: schema.Properties,
		Required:   schema.Required,
		Type:       "object",
	}
}
