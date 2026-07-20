import { Moon, Sun } from 'lucide-react'
import { Button } from './ui/button'
import { useTheme } from '../app/theme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      // Lives on the dark chrome bar — hover states against black, not gray.
      className="rounded-full text-chrome-foreground/80 hover:bg-white/10 hover:text-white"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
