"use client";

import { useState } from "react";
import { createSuppliersBatch } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Info, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface BulkImportSuppliersDialogProps {
  onSuppliersImported?: () => Promise<void>;
}

interface ImportResult {
  total: number;
  created: number;
  errors: string[];
}

export function BulkImportSuppliersDialog({
  onSuppliersImported,
}: BulkImportSuppliersDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Парсинг текстового формату: Назва | Телефон | Примітки
  const parseTextInput = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return {
        name: parts[0] || "",
        phone: parts[1] || null,
        notes: parts[2] || null,
      };
    });
  };

  // Парсинг CSV формату
  const parseCSV = async (
    file: File
  ): Promise<
    Array<{ name: string; phone?: string | null; notes?: string | null }>
  > => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = (e.target?.result as string).replace(/\r/g, "");
          const lines = text.split("\n").filter((line) => line.trim().length > 0);

          if (lines.length === 0) {
            resolve([]);
            return;
          }

          // Перевіряємо чи є заголовок
          const firstLine = lines[0].toLowerCase();
          const hasHeader =
            firstLine.includes("назва") ||
            firstLine.includes("name") ||
            firstLine.includes("телефон") ||
            firstLine.includes("phone");

          const dataLines = hasHeader ? lines.slice(1) : lines;

          const suppliers = dataLines.map((line) => {
            // Простий CSV парсер - підтримка лапок та ком
            let parts: string[] = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];

              if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                  // Подвійна лапка - екранована лапка
                  current += '"';
                  i++;
                } else {
                  // Початок/кінець поля в лапках
                  inQuotes = !inQuotes;
                }
              } else if (char === "," && !inQuotes) {
                // Роздільник
                parts.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            // Додаємо останнє поле
            parts.push(current.trim());

            // Обробляємо результати
            return {
              name: (parts[0] || "").replace(/^"|"$/g, "").trim(),
              phone: parts[1]
                ? (parts[1] || "").replace(/^"|"$/g, "").trim() || null
                : null,
              notes: parts[2]
                ? (parts[2] || "").replace(/^"|"$/g, "").trim() || null
                : null,
            };
          });

          resolve(suppliers);
        } catch (error) {
          reject(new Error("Помилка при парсингу CSV файлу"));
        }
      };

      reader.onerror = () => reject(new Error("Помилка при читанні файлу"));
      reader.readAsText(file, "UTF-8");
    });
  };

  const handleTextImport = async () => {
    if (!textInput.trim()) {
      toast.error("Помилка", {
        description: "Введіть дані для імпорту",
      });
      return;
    }

    setIsPending(true);
    setImportResult(null);

    try {
      const suppliers = parseTextInput(textInput);
      
      if (suppliers.length === 0) {
        toast.error("Помилка", {
          description: "Не знайдено постачальників для додавання",
        });
        setIsPending(false);
        return;
      }

      const result = await createSuppliersBatch(suppliers);

      if (result.success && result.data) {
        setImportResult({
          total: result.total || suppliers.length,
          created: result.created || result.data.length,
          errors: [],
        });

        toast.success("Імпорт завершено", {
          description: `Успішно додано ${result.created || result.data.length} з ${result.total || suppliers.length} постачальників`,
        });

        // Очищаємо поле після успішного імпорту
        setTextInput("");

        // Оновлюємо список
        if (onSuppliersImported) {
          await onSuppliersImported();
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося імпортувати постачальників",
        });
      }
    } catch (error) {
      console.error("Помилка при імпорті:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при імпорті постачальників",
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleCSVImport = async () => {
    if (!csvFile) {
      toast.error("Помилка", {
        description: "Виберіть CSV файл для імпорту",
      });
      return;
    }

    setIsPending(true);
    setImportResult(null);

    try {
      const suppliers = await parseCSV(csvFile);
      
      if (suppliers.length === 0) {
        toast.error("Помилка", {
          description: "CSV файл порожній або не містить валідних даних",
        });
        setIsPending(false);
        return;
      }

      const result = await createSuppliersBatch(suppliers);

      if (result.success && result.data) {
        setImportResult({
          total: result.total || suppliers.length,
          created: result.created || result.data.length,
          errors: [],
        });

        toast.success("Імпорт завершено", {
          description: `Успішно додано ${result.created || result.data.length} з ${result.total || suppliers.length} постачальників`,
        });

        // Очищаємо файл після успішного імпорту
        setCsvFile(null);

        // Оновлюємо список
        if (onSuppliersImported) {
          await onSuppliersImported();
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося імпортувати постачальників",
        });
      }
    } catch (error: any) {
      console.error("Помилка при імпорті CSV:", error);
      toast.error("Помилка", {
        description: error.message || "Сталася помилка при імпорті CSV файлу",
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTextInput("");
    setCsvFile(null);
    setImportResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Масовий імпорт
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Масовий імпорт постачальників</DialogTitle>
          <DialogDescription>
            Додайте кілька постачальників одночасно через текстовий формат або
            CSV файл
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Текстовий формат</TabsTrigger>
            <TabsTrigger value="csv">CSV файл</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Формат введення</AlertTitle>
              <AlertDescription className="mt-2">
                Введіть постачальників, кожен на новому рядку, у форматі:
                <br />
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  Назва | Телефон | Примітки
                </code>
                <br />
                Телефон та примітки необов'язкові.
                <br />
                <strong>Приклад:</strong>
                <br />
                <code className="text-xs bg-muted px-1 py-0.5 rounded block mt-1">
                  Компанія АБВ | +380123456789 | Основний постачальник
                  <br />
                  ФОП Іванов | +380987654321 | Деревина
                  <br />
                  ТОВ Ромашка | | Меблі
                </code>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="text-input">Дані постачальників</Label>
              <Textarea
                id="text-input"
                placeholder="Назва | Телефон | Примітки&#10;Компанія АБВ | +380123456789 | Основний постачальник&#10;ФОП Іванов | +380987654321 | Деревина"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {textInput.split("\n").filter((l) => l.trim().length > 0).length}{" "}
                рядків для імпорту
              </p>
            </div>

            {importResult && (
              <Alert
                variant={importResult.created > 0 ? "default" : "destructive"}
              >
                {importResult.created > 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  Результат імпорту: {importResult.created} з {importResult.total}
                </AlertTitle>
                <AlertDescription>
                  Успішно додано {importResult.created} постачальників
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Скасувати
              </Button>
              <Button onClick={handleTextImport} disabled={isPending || !textInput.trim()}>
                {isPending ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Імпорт...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Імпортувати
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="csv" className="space-y-4 mt-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>Формат CSV файлу</AlertTitle>
              <AlertDescription className="mt-2">
                CSV файл повинен містити колонки: <strong>Назва</strong>,{" "}
                <strong>Телефон</strong>, <strong>Примітки</strong>
                <br />
                Заголовок необов'язковий. Роздільник - кома. Значення можуть
                бути в лапках.
                <br />
                <strong>Приклад:</strong>
                <br />
                <code className="text-xs bg-muted px-1 py-0.5 rounded block mt-1">
                  Назва,Телефон,Примітки
                  <br />
                  "Компанія АБВ","+380123456789","Основний постачальник"
                  <br />
                  ФОП Іванов,+380987654321,Деревина
                </code>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="csv-file">Виберіть CSV файл</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCsvFile(file);
                  }
                }}
              />
              {csvFile && (
                <p className="text-sm text-muted-foreground">
                  Вибрано: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            {importResult && (
              <Alert
                variant={importResult.created > 0 ? "default" : "destructive"}
              >
                {importResult.created > 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  Результат імпорту: {importResult.created} з {importResult.total}
                </AlertTitle>
                <AlertDescription>
                  Успішно додано {importResult.created} постачальників
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Скасувати
              </Button>
              <Button
                onClick={handleCSVImport}
                disabled={isPending || !csvFile}
              >
                {isPending ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Імпорт...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Імпортувати CSV
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

