import Link from "next/link";
import { FOOTER_NAV_SECTIONS } from "@/lib/navigation/footer-nav";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/40 mt-auto">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Облік виробництва</h3>
            <p className="text-sm text-muted-foreground">
              ERP система для управління виробництвом та обліком продукції
              підприємства Форест Україна
            </p>
          </div>

          {FOOTER_NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-4">
              <h3 className="font-semibold text-lg">{section.title}</h3>
              <ul className="space-y-3 text-sm">
                {section.groups.map((group) => (
                  <li key={group.label}>
                    {group.items && group.items.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">
                          {group.label}
                        </p>
                        <ul className="space-y-1.5 border-l pl-3">
                          {group.items.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : group.href ? (
                      <Link
                        href={group.href}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {group.label}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Форест Україна. Всі права захищені.
          </p>
          <p className="text-sm text-muted-foreground">
            ERP система для обліку виробництва
          </p>
        </div>
      </div>
    </footer>
  );
}
