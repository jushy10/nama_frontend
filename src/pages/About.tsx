function About() {
  return (
    <div className="mx-auto max-w-2xl p-8 text-left">
      <h1 className="mb-4 text-3xl font-bold text-indigo-500">About</h1>
      <p className="mb-4 text-gray-400">
        This page is styled entirely with Tailwind CSS utility classes to show
        the setup is working end to end.
      </p>
      <ul className="list-inside list-disc space-y-1 text-gray-400">
        <li>Routing via React Router</li>
        <li>
          The <code className="text-indigo-400">@/</code> import alias points at{' '}
          <code className="text-indigo-400">src/</code>
        </li>
        <li>Unit tests run with Vitest</li>
      </ul>
    </div>
  )
}

export default About
