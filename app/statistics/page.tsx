import Link from "next/link"
import { getProductionStats, getShifts, getProducts, getProductCategories, getShiftDetails } from "@/app/actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, BarChart, Package, PieChart, TrendingUp } from "lucide-react"
import type { ShiftWithDetails } from "@/lib/types"

export default async function StatisticsPage() {
  // Отримуємо дані для статистики
  const [productionStats, shiftsData, products, categories] = await Promise.all([
    getProductionStats(),
    getShifts(),
    getProducts(),
    getProductCategories(),
  ])

  // Отримуємо детальну інформацію про зміни з виробництвом
  const shiftsWithDetails = await Promise.all(
    shiftsData.filter((shift) => shift.status === "completed").map(async (shift) => await getShiftDetails(shift.id)),
  )

  // Фільтруємо null значення
  const shifts = shiftsWithDetails.filter(Boolean) as ShiftWithDetails[]

  const { totalProduction, productionByCategory } = productionStats

  // Підготовка даних для візуалізації
  const categoryColors: Record<string, string> = {
    "Без категорії": "hsl(var(--muted))",
  }

  // Призначаємо кольори для категорій
  categories.forEach((category, index) => {
    // Використовуємо різні відтінки для категорій
    const hues = [200, 150, 100, 50, 300, 250, 350]
    categoryColors[category.name] = `hsl(${hues[index % hues.length]}, 70%, 50%)`
  })

  // Розрахунок відсотків для кожної категорії
  const categoryPercentages: Record<string, number> = {}
  Object.entries(productionByCategory).forEach(([category, amount]) => {
    categoryPercentages[category] = totalProduction > 0 ? (amount / totalProduction) * 100 : 0
  })

  // Сортуємо категорії за кількістю продукції (від більшої до меншої)
  const sortedCategories = Object.entries(productionByCategory).sort((a, b) => b[1] - a[1])

  // Підрахунок статистики по змінах
  const completedShifts = shifts.filter((shift) => shift.status === "completed")
  const shiftsWithProduction = completedShifts.length
  const averageProductionPerShift = shiftsWithProduction > 0 ? totalProduction / shiftsWithProduction : 0

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Статистика виробництва</h1>
        <p className="text-muted-foreground">Аналіз виробленої продукції за всіма змінами</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span>Загальне виробництво</span>
            </CardTitle>
            <CardDescription>Загальна кількість виробленої продукції</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{totalProduction} шт</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              <span>Завершені зміни</span>
            </CardTitle>
            <CardDescription>Кількість завершених змін з виробництвом</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{shiftsWithProduction}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Середнє виробництво</span>
            </CardTitle>
            <CardDescription>Середня кількість продукції на зміну</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{averageProductionPerShift.toFixed(1)} шт</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              <span>Розподіл за категоріями</span>
            </CardTitle>
            <CardDescription>Відсоткове співвідношення виробленої продукції за категоріями</CardDescription>
          </CardHeader>
          <CardContent>
            {totalProduction === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Немає даних про виробництво</div>
            ) : (
              <div className="space-y-4">
                {/* Візуалізація у вигляді горизонтальних смуг */}
                <div className="h-8 w-full bg-muted rounded-full overflow-hidden flex">
                  {sortedCategories.map(([category, amount], index) => {
                    const percentage = categoryPercentages[category]
                    const color = categoryColors[category] || "hsl(var(--primary))"
                    return (
                      <div
                        key={category}
                        className="h-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                          transition: "width 1s ease-in-out",
                        }}
                        title={`${category}: ${amount} шт (${percentage.toFixed(1)}%)`}
                      ></div>
                    )
                  })}
                </div>

                {/* Легенда */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {sortedCategories.map(([category, amount]) => {
                    const percentage = categoryPercentages[category]
                    const color = categoryColors[category] || "hsl(var(--primary))"
                    return (
                      <div key={category} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: color }}></div>
                        <div className="flex-1 flex justify-between items-center">
                          <span className="font-medium">{category}</span>
                          <span className="text-sm text-muted-foreground">
                            {amount} шт ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              <span>Деталі по категоріям</span>
            </CardTitle>
            <CardDescription>Кількість виробленої продукції за категоріями</CardDescription>
          </CardHeader>
          <CardContent>
            {totalProduction === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Немає даних про виробництво</div>
            ) : (
              <div className="space-y-4">
                {sortedCategories.map(([category, amount]) => {
                  const percentage = categoryPercentages[category]
                  const color = categoryColors[category] || "hsl(var(--primary))"
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{category}</span>
                        <span className="text-sm font-medium">{amount} шт</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <span>Деталі виробництва</span>
          </CardTitle>
          <CardDescription>Детальна інформація про вироблену продукцію</CardDescription>
        </CardHeader>
        <CardContent>
          {totalProduction === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Немає даних про виробництво</div>
          ) : (
            <div className="space-y-6">
              {/* Створюємо графік для кожної категорії */}
              {sortedCategories
                .map(([category, totalAmount]) => {
                  // Фільтруємо продукти цієї категорії
                  const categoryProducts = products.filter(
                    (product) =>
                      (category === "Без категорії" && !product.category_id) || product.category?.name === category,
                  )

                  // Отримуємо статистику виробництва для кожного продукту
                  const productStats = categoryProducts.map((product) => {
                    // Підраховуємо загальну кількість виробленої продукції для цього продукту
                    let productTotal = 0

                    // Проходимо по всіх змінах і шукаємо виробництво цього продукту
                    shifts.forEach((shift) => {
                      if (shift.production) {
                        const productionItem = shift.production.find((item) => item.product_id === product.id)
                        if (productionItem) {
                          productTotal += productionItem.quantity
                        }
                      }
                    })

                    return {
                      product,
                      total: productTotal,
                      percentage: totalProduction > 0 ? (productTotal / totalProduction) * 100 : 0,
                    }
                  })

                  // Сортуємо продукти за кількістю виробництва (від більшого до меншого)
                  const sortedProducts = productStats
                    .filter((stat) => stat.total > 0) // Показуємо тільки продукти з виробництвом
                    .sort((a, b) => b.total - a.total)

                  // Якщо немає продуктів з виробництвом у цій категорії, пропускаємо
                  if (sortedProducts.length === 0) return null

                  // Знаходимо максимальне значення для масштабування графіка
                  const maxValue = Math.max(...sortedProducts.map((p) => p.total))

                  return (
                    <div key={category} className="pt-4">
                      <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: categoryColors[category] || "hsl(var(--primary))" }}
                        ></div>
                        {category}
                      </h3>

                      <div className="space-y-3">
                        {sortedProducts.map(({ product, total, percentage }) => (
                          <div key={product.id} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-medium truncate max-w-[60%]" title={product.name}>
                                {product.name}
                              </span>
                              <span className="text-sm font-medium">
                                {total} шт <span className="text-muted-foreground">({percentage.toFixed(1)}%)</span>
                              </span>
                            </div>
                            <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full rounded-md transition-all duration-500 ease-in-out flex items-center justify-between px-2"
                                style={{
                                  width: `${Math.max((total / maxValue) * 100, 10)}%`,
                                  backgroundColor: categoryColors[category] || "hsl(var(--primary))",
                                }}
                              >
                                <span className="text-xs font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis">
                                  {total} <span className="opacity-80">({percentage.toFixed(1)}%)</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
                .filter(Boolean)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

