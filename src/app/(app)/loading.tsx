import { Card, TableSkeleton } from '@/components/ui/primitives'

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-48" />
      <Card>
        <TableSkeleton />
      </Card>
    </div>
  )
}
