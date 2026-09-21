import { Button } from '@/components/ui/primitives'

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <Button type="submit" variant="secondary" size="sm">
        Sign out
      </Button>
    </form>
  )
}
