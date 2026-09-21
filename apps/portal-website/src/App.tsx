function App() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full space-y-4">
        <h1 className="text-2xl font-bold text-neutral-900">
          SmartBusinessSolutions
        </h1>
        <p className="text-neutral-600">
          Tailwind is working with our shared design system.
        </p>
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-md text-sm text-white bg-primary-600">
            Approved
          </span>
          <span className="px-3 py-1 rounded-md text-sm text-white bg-warning-500">
            Pending
          </span>
          <span className="px-3 py-1 rounded-md text-sm text-white bg-danger-600">
            Voided
          </span>
          <span className="px-3 py-1 rounded-md text-sm text-white bg-success-600">
            Printed
          </span>
        </div>
      </div>
    </div>
  )
}

export default App