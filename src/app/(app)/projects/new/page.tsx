import { ProjectForm } from '@/components/projects/ProjectForm'

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-900 dark:text-zinc-50">New project</h1>
        <p className="mt-1 text-sm text-zinc-500">Share a project with the Omnia Collective.</p>
      </div>
      <ProjectForm mode="create" />
    </div>
  )
}
