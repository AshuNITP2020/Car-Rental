import { Link } from 'react-router-dom'
import { Button } from './ui/button'

export function NotFound() {
  return (
    <div className="space-y-4 py-20 text-center">
      <p className="text-5xl">🚗💨</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">The page you’re looking for doesn’t exist.</p>
      <Link to="/">
        <Button variant="outline">Back to browse</Button>
      </Link>
    </div>
  )
}
