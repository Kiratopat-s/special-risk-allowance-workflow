import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Code2,
  ExternalLink,
  FileText,
  MapPin,
  PenLine,
  ShieldCheck,
  Star,
} from "lucide-react";
import { CursorSpotlight } from "@/components/cursor-spotlight";

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const MODULES = [
  {
    icon: ClipboardList,
    label: "Monthly Request Collection",
    title: "สรุปคำขอรายเดือน",
    desc: "รวบรวมและจัดการคำขอค่าตอบแทนเสี่ยงภัยรายเดือน พร้อมออกเอกสารทางการสำหรับกองบัญชี",
  },
  {
    icon: FileText,
    label: "Expense Claims",
    title: "เอกสารเบิกจ่าย",
    desc: "ยื่นคำขอเบิกค่าตอบแทนเสี่ยงภัยพิเศษรายบุคคล พร้อมบันทึกจำนวนวันและรายละเอียดครบถ้วน",
  },
  {
    icon: MapPin,
    label: "Off-site Work",
    title: "บันทึกงานนอกพื้นที่",
    desc: "ติดตามและบันทึกการปฏิบัติงานในพื้นที่เสี่ยงภัย เพื่อใช้ประกอบการเบิกค่าตอบแทน",
  },
  {
    icon: PenLine,
    label: "Digital Signatures",
    title: "ลายเซ็นดิจิทัล",
    desc: "วาดและจัดเก็บลายเซ็นส่วนตัวสำหรับผู้อนุมัติ ระบบพิมพ์ลายเซ็นลงเอกสารโดยอัตโนมัติ",
  },
  {
    icon: CheckCircle2,
    label: "Multi-stage Approval",
    title: "ขั้นตอนอนุมัติ",
    desc: "กระบวนการ 3 ขั้น: หผ. ตรวจสอบ → รก. ตรวจสอบ → อก. อนุมัติ พร้อม Audit Trail",
  },
  {
    icon: ShieldCheck,
    label: "Role-based Access",
    title: "สิทธิ์ตามบทบาท",
    desc: "จัดการสิทธิ์ผู้ใช้แบบละเอียดตามบทบาทและหน่วยงาน รองรับ Own/Department/All Scope",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "ยื่นคำขอ",
    desc: "ผู้ปฏิบัติงานบันทึกรายละเอียดการปฏิบัติงานในพื้นที่เสี่ยงและยื่นคำขอเบิก",
  },
  {
    n: "02",
    title: "ตรวจสอบ",
    desc: "หัวหน้าและรองหัวหน้าตรวจสอบความถูกต้องก่อนส่งต่อผู้มีอำนาจอนุมัติ",
  },
  {
    n: "03",
    title: "อนุมัติ & ออกเอกสาร",
    desc: "ผู้อำนวยการอนุมัติและระบบสร้างเอกสารทางการพร้อมลายเซ็นดิจิทัลโดยอัตโนมัติ",
  },
] as const;

const TECH = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Tailwind CSS v4",
  "shadcn/ui",
  "Auth.js v5",
  "Keycloak",
  "Prisma ORM",
  "PostgreSQL",
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function Home() {
  const session = await auth();

  if (session?.user?.dbUserId) {
    redirect("/dashboard");
  }

  return (
    <>
      <CursorSpotlight />

      <div className="flex flex-col">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative flex min-h-[88vh] items-center overflow-hidden">
          {/* layered background */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,oklch(0.21_0.006_285.885/0.06),transparent)] dark:bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,oklch(0.985_0.002_247.858/0.05),transparent)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,oklch(0_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0_0_0/0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)] bg-size-[40px_40px]" />

          <div className="container mx-auto max-w-5xl px-4 py-24 text-center">
            <div className="flex flex-col items-center space-y-8">
              <Badge
                variant="outline"
                className="gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
              >
                <Building2 className="h-3.5 w-3.5" />
                การไฟฟ้าส่วนภูมิภาค · Provincial Electricity Authority
              </Badge>

              <div className="space-y-5 max-w-4xl">
                <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-[5.5rem] lg:leading-none">
                  <span className="block">ค่าตอบแทน</span>
                  <span className="block text-muted-foreground">
                    เสี่ยงภัยพิเศษ
                  </span>
                </h1>
                <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">
                  <span className="font-medium text-foreground">
                    Special Risk Allowance Workflow
                  </span>{" "}
                  — ระบบจัดการเบิกค่าตอบแทนเสี่ยงภัยพิเศษครบวงจร
                  ตั้งแต่การยื่นคำขอ ตรวจสอบ อนุมัติ จนถึงออกเอกสารทางการ
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
                <Button asChild size="lg" className="group min-w-40">
                  <Link href="/api/auth/signin?callbackUrl=/dashboard">
                    เข้าสู่ระบบ
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link
                    href="https://github.com/Kiratopat-s/special-risk-allowance-workflow"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Code2 className="mr-2 h-4 w-4" />
                    View Source
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Modules ───────────────────────────────────────────────── */}
        <section className="border-t border-border/40 bg-muted/20">
          <div className="container mx-auto max-w-6xl px-4 py-24">
            <div className="mb-16 text-center space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Core Modules
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                ครบครันทุกขั้นตอน
              </h2>
              <p className="mx-auto max-w-md text-muted-foreground">
                รองรับทุกกระบวนการตั้งแต่บันทึกปฏิบัติงาน จนถึงออกเอกสารการเงิน
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map(({ icon: Icon, label, title, desc }) => (
                <div
                  key={label}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/30 hover:shadow-[0_8px_40px_-8px_oklch(0_0_0/0.12)] dark:hover:shadow-[0_8px_40px_-8px_oklch(1_0_0/0.08)]"
                >
                  {/* top-edge glow on hover */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background text-foreground transition-colors group-hover:border-primary/30 group-hover:bg-background">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Workflow steps ────────────────────────────────────────── */}
        <section className="border-t border-border/40">
          <div className="container mx-auto max-w-5xl px-4 py-24">
            <div className="mb-16 text-center space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Workflow
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                3 ขั้นตอนง่ายๆ
              </h2>
            </div>

            <div className="grid gap-10 md:grid-cols-3">
              {STEPS.map(({ n, title, desc }, i) => (
                <div key={n} className="relative text-center space-y-4">
                  {/* connector line */}
                  {i < STEPS.length - 1 && (
                    <span className="absolute top-5 left-[calc(50%+2.5rem)] hidden h-px w-[calc(100%-4.5rem)] border-t border-dashed border-border md:block" />
                  )}
                  <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-border bg-card text-sm font-bold">
                    {n}
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-semibold text-lg">{title}</h3>
                    <p className="mx-auto max-w-55 text-sm leading-relaxed text-muted-foreground">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tech stack ────────────────────────────────────────────── */}
        <section className="border-t border-border/40 bg-muted/20">
          <div className="container mx-auto max-w-4xl px-4 py-20">
            <div className="mb-10 text-center space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Tech Stack
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                Built with modern tools
              </h2>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              {TECH.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Developer ─────────────────────────────────────────────── */}
        <section className="border-t border-border/40">
          <div className="container mx-auto max-w-sm px-4 py-24 text-center">
            <div className="mb-10 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Developer
              </p>
              <h2 className="text-2xl font-bold tracking-tight">Built by</h2>
            </div>

            <div className="group rounded-2xl border border-border/60 bg-card p-8 transition-all duration-300 hover:border-primary/30 hover:bg-accent/30 hover:shadow-[0_8px_40px_-8px_oklch(0_0_0/0.12)] dark:hover:shadow-[0_8px_40px_-8px_oklch(1_0_0/0.08)]">
              <div className="flex flex-col items-center gap-5">
                <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://github.com/Kiratopat-s.png"
                    alt="Kiratopat-s"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-lg font-semibold">
                    Kiratipat Sawangsisombat
                  </p>
                  <p className="text-sm text-muted-foreground">
                    @Kiratopat-s · Full-stack Developer
                  </p>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href="https://github.com/Kiratopat-s"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Code2 className="mr-1.5 h-3.5 w-3.5" />
                      GitHub
                      <ExternalLink className="ml-1.5 h-3 w-3 opacity-40" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href="https://github.com/Kiratopat-s/special-risk-allowance-workflow"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Star className="mr-1.5 h-3.5 w-3.5" />
                      Star Repo
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
