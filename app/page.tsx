import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/workflow-ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
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
import { WorkspaceGuide } from "@/components/workflow-ui/workspace-guide";

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
  "MUI",
  "React Bits",
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


      <div className="flex flex-col">
        <section className="border-b bg-card">
          <div className="container mx-auto max-w-7xl grid gap-12 lg:grid-cols-2 lg:items-center px-5 py-16 sm:py-16">
            <div><div className="eyebrow">PROVINCIAL ELECTRICITY AUTHORITY</div><p className="text-sm text-muted-foreground mb-7">การไฟฟ้าส่วนภูมิภาค</p><h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.3]">ค่าตอบแทน<br /><span className="text-primary">เสี่ยงภัยพิเศษ</span></h1><p className="text-base leading-8 text-muted-foreground mt-6 max-w-lg">Special Risk Allowance Workflow — ระบบจัดการเบิกค่าตอบแทนเสี่ยงภัยพิเศษครบวงจร ตั้งแต่การยื่นคำขอ ตรวจสอบ อนุมัติ จนถึงออกเอกสารทางการ</p><div className="flex flex-wrap gap-3 mt-8"><Button asChild size="lg"><Link href="/auth/signin?callbackUrl=%2Fdashboard">เข้าสู่พื้นที่ทำงาน<ArrowRight size={17} /></Link></Button><Button variant="outline" asChild size="lg"><Link href="/how-to-use">คู่มือการใช้งาน</Link></Button></div><Link href="https://github.com/Kiratopat-s/special-risk-allowance-workflow" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-muted-foreground mt-6"><Code2 size={14} />View Source<ExternalLink size={12} /></Link></div>
            <WorkspaceGuide />
          </div>
        </section>

        {/* ── Modules ───────────────────────────────────────────────── */}
        <section className="border-t border-border/40 bg-muted/20">
          <div className="container mx-auto max-w-6xl px-4 py-16">
            <div className="mb-10 text-center space-y-3">
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
          <div className="container mx-auto max-w-5xl px-4 py-16">
            <div className="mb-10 text-center space-y-3">
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
          <div className="container mx-auto max-w-sm px-4 py-16 text-center">
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
                      <Code2 className="h-3.5 w-3.5" />
                      GitHub
                      <ExternalLink className="h-3 w-3 opacity-40" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href="https://github.com/Kiratopat-s/special-risk-allowance-workflow"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Star className="h-3.5 w-3.5" />
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
