import Link from "next/link"
import { getShifts } from "@/app/actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { ArrowLeft, Calendar, Clock, Plus } from "lucide-react"

export default async function ShiftsPage() {
  const shifts = await getShifts()

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Всі зміни</h1>
        <Link href="/shifts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            <span>Створити зміну</span>
          </Button>
        </Link>
      </div>

      {shifts.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Немає зареєстрованих змін</p>
              <Link href="/shifts/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Створити зміну</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {shifts.map((shift) => (
            <Link key={shift.id} href={`/shifts/${shift.id}`}>
              <Card className="h-full hover:bg-muted/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Зміна #{shift.id}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(shift.shift_date)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <Badge variant={shift.status === "active" ? "default" : "secondary"}>
                      {shift.status === "active" ? "Активна" : "Завершена"}
                    </Badge>

                    {shift.status === "completed" && shift.completed_at && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Завершено: {formatDate(shift.completed_at)}</span>
                      </div>
                    )}

                    {shift.notes && <p className="mt-1 text-sm text-muted-foreground">{shift.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

