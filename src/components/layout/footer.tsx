export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Brand */}
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>Built by</span>
            <a
              href="https://buildproven.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
            >
              BuildProven
            </a>
          </div>

          {/* Links */}
          <nav
            className="flex items-center gap-6 text-sm"
            aria-label="Footer navigation"
          >
            <a
              href="https://github.com/buildproven/keyflash"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://buildproven.ai/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Privacy
            </a>
            <a
              href="https://buildproven.ai/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Terms
            </a>
          </nav>

          {/* Copyright */}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            © {currentYear} BuildProven LLC
          </div>
        </div>
      </div>
    </footer>
  )
}
