interface SkillChipsProps {
  skills: string[]
}

export function SkillChips({ skills }: SkillChipsProps) {
  if (skills.length === 0) {
    return <p className="text-sm text-zinc-500">No skills listed.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span
          key={skill}
          className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {skill}
        </span>
      ))}
    </div>
  )
}
