"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Database, RefreshCw } from "lucide-react"

interface DatabaseErrorProps {
  onRetry?: () => void
}

export function DatabaseError({ onRetry }: DatabaseErrorProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle>Помилка підключення до бази даних</CardTitle>
        </div>
        <CardDescription>Не вдалося підключитися до бази даних Supabase</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-center py-4">
            <Database className="h-16 w-16 text-muted-foreground" />
          </div>
          <div className="text-sm space-y-2">
            <p>Можливі причини:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Не налаштовані змінні середовища для Supabase</li>
              <li>Проблеми з підключенням до сервера Supabase</li>
              <li>Неправильні облікові дані для доступу до бази даних</li>
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        {onRetry && (
          <Button onClick={onRetry} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Спробувати знову
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

