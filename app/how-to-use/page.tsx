import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  FolderOpen,
  KeyRound,
  MapPin,
  Printer,
  RefreshCw,
  ShieldCheck,
  Signature,
  UserCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "วิธีใช้ระบบ / How to Use | Special Risk Allowance Workflow",
  description:
    "Thai-first visual guide for the Special Risk Allowance Workflow, including workflow stages, roles, statuses, and possible events.",
};

interface FlowStage {
  label: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

interface RoleLane {
  role: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface StatusItem {
  code: string;
  label: string;
  description: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

interface EventGroup {
  title: string;
  label: string;
  icon: LucideIcon;
  events: string[];
}

function signInHref(callbackUrl: string): string {
  return `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

const FLOW_STAGES: FlowStage[] = [
  {
    label: "01",
    title: "Employee",
    description: "ผู้ใช้เข้าสู่ระบบและเตรียมข้อมูลส่วนตัวให้พร้อม",
    href: signInHref("/dashboard"),
    icon: UserCheck,
  },
  {
    label: "02",
    title: "Off-site Work",
    description: "บันทึกงานนอกพื้นที่ เอกสารอ้างอิง วันที่ สถานที่ และหัวหน้า",
    href: signInHref("/dashboard?tab=off-site-work"),
    icon: MapPin,
  },
  {
    label: "03",
    title: "Expense Claim",
    description: "สร้างเอกสารเบิกจ่าย เลือกวันปฏิบัติงาน และส่งตรวจสอบ",
    href: signInHref("/dashboard?tab=expense-claims"),
    icon: FileText,
  },
  {
    label: "04",
    title: "Leader Verification",
    description: "หัวหน้าภายในหรือภายนอกยืนยันใบสั่งปฏิบัติงาน",
    href: signInHref("/dashboard?tab=leader-queue"),
    icon: ClipboardCheck,
  },
  {
    label: "05",
    title: "Monthly Collection",
    description: "ผู้รวบรวมเลือกคำขอที่พร้อม และสร้างรายการประจำเดือน",
    href: signInHref("/dashboard?tab=monthly-requests"),
    icon: FolderOpen,
  },
  {
    label: "06",
    title: "HPA / RK / OK",
    description: "ตรวจสอบตามลำดับ หผ. ตรวจสอบ, รก. ตรวจสอบ, อก. อนุมัติ",
    href: signInHref("/dashboard?tab=monthly-requests"),
    icon: ShieldCheck,
  },
  {
    label: "07",
    title: "Print / Archive",
    description: "พิมพ์เอกสารพร้อมลายมือชื่อและเก็บประวัติการดำเนินการ",
    href: signInHref("/dashboard?tab=monthly-requests"),
    icon: Printer,
  },
];

const ROLE_LANES: RoleLane[] = [
  {
    role: "Employee",
    label: "พนักงาน",
    description: "บันทึกงานนอกพื้นที่ สร้างเอกสารเบิกจ่าย และติดตามสถานะ",
    icon: UserCheck,
  },
  {
    role: "Leader",
    label: "หัวหน้า",
    description: "ยืนยันการออกปฏิบัติงานผ่านคิวภายในหรือลิงก์ภายนอก",
    icon: ClipboardCheck,
  },
  {
    role: "Collector",
    label: "ผู้รวบรวม",
    description: "รวบรวมคำขอที่พร้อมเป็นรายการประจำเดือน",
    icon: FolderOpen,
  },
  {
    role: "HPA",
    label: "หผ.",
    description: "ตรวจสอบขั้นแรกของรายการประจำเดือน",
    icon: CheckCircle2,
  },
  {
    role: "RK",
    label: "รก.",
    description: "ตรวจสอบขั้นที่สองหลัง หผ. ผ่านแล้ว",
    icon: FileCheck2,
  },
  {
    role: "OK / DRT",
    label: "อก.",
    description: "อนุมัติขั้นสุดท้ายและปล่อยให้เอกสารเสร็จสมบูรณ์",
    icon: ShieldCheck,
  },
  {
    role: "System",
    label: "ระบบ",
    description: "แจ้งเตือน ส่งอีเมล เก็บลายมือชื่อ และบันทึก audit trail",
    icon: Bell,
  },
];

const EXPENSE_CLAIM_STATUSES: StatusItem[] = [
  {
    code: "DRAFT",
    label: "ร่าง",
    description: "กำลังเตรียมเอกสาร ยังไม่ส่งเข้าสู่กระบวนการ",
    tone: "neutral",
  },
  {
    code: "PENDING",
    label: "รอดำเนินการ",
    description: "ส่งแล้ว และไม่มีรายการยืนยันหัวหน้าที่ต้องรอ",
    tone: "info",
  },
  {
    code: "PENDING_LEADER_VERIFY",
    label: "รอหัวหน้ายืนยัน",
    description: "มีใบสั่งที่ต้องให้หัวหน้าภายในหรือภายนอกยืนยัน",
    tone: "warning",
  },
  {
    code: "WAIT_FOR_COLLECTION",
    label: "พร้อมรวบรวม",
    description: "หัวหน้ายืนยันครบแล้ว รอผู้รวบรวมนำเข้ารายการรายเดือน",
    tone: "success",
  },
  {
    code: "COLLECTED",
    label: "รวบรวมแล้ว",
    description: "เอกสารถูกเชื่อมกับรายการรวบรวมประจำเดือน",
    tone: "info",
  },
  {
    code: "APPROVED",
    label: "อนุมัติ",
    description: "รายการรายเดือนผ่าน อก. แล้ว และคำขอถูกอนุมัติ",
    tone: "success",
  },
  {
    code: "REJECTED",
    label: "ปฏิเสธ",
    description: "เอกสารถูกปฏิเสธในบริบทที่เกี่ยวข้อง",
    tone: "danger",
  },
  {
    code: "CANCELLED",
    label: "ยกเลิก",
    description: "เอกสารถูกยกเลิกและไม่ถูกนำไปดำเนินการต่อ",
    tone: "danger",
  },
];

const APPROVAL_STAGES: StatusItem[] = [
  {
    code: "HPA_CHECK",
    label: "หผ. ตรวจสอบ",
    description: "เปิดเป็นขั้นแรกเมื่อส่งรายการรายเดือน",
    tone: "info",
  },
  {
    code: "RK_CHECK",
    label: "รก. ตรวจสอบ",
    description: "เปิดหลังจาก หผ. อนุมัติแล้วเท่านั้น",
    tone: "warning",
  },
  {
    code: "OK_APPROVE",
    label: "อก. อนุมัติ",
    description: "ขั้นสุดท้ายที่เปลี่ยนรายการและคำขอเป็นอนุมัติ",
    tone: "success",
  },
];

const STEP_STATUSES: StatusItem[] = [
  {
    code: "PENDING",
    label: "รอดำเนินการ",
    description: "ขั้นนี้กำลังรอผู้มีสิทธิ์ตรวจสอบ",
    tone: "warning",
  },
  {
    code: "APPROVED",
    label: "ผ่าน",
    description: "ขั้นนี้ผ่านแล้ว ระบบเปิดขั้นถัดไปหรือจบงาน",
    tone: "success",
  },
  {
    code: "REJECTED",
    label: "ปฏิเสธ",
    description: "รายการรายเดือนหยุด และคำขอที่เชื่อมไว้กลับไปรอรวบรวม",
    tone: "danger",
  },
];

const EVENT_GROUPS: EventGroup[] = [
  {
    title: "Access / Profile",
    label: "สิทธิ์และโปรไฟล์",
    icon: KeyRound,
    events: [
      "เข้าสู่ระบบด้วย Keycloak",
      "ซิงก์ข้อมูลผู้ใช้และหน่วยงาน",
      "ตรวจสิทธิ์ตามบทบาทและ scope",
    ],
  },
  {
    title: "Off-site Work",
    label: "งานนอกพื้นที่",
    icon: MapPin,
    events: [
      "สร้างบันทึกงานนอกพื้นที่",
      "แก้ไขวันที่ สถานที่ เอกสารอ้างอิง หรือหัวหน้า",
      "แนบหรืออ้างอิงไฟล์หลักฐาน",
    ],
  },
  {
    title: "Expense Claim",
    label: "เอกสารเบิกจ่าย",
    icon: FileText,
    events: [
      "บันทึกเอกสารเป็น DRAFT",
      "ส่งเอกสารจาก DRAFT",
      "บล็อกการส่งเมื่อใบสั่งยังไม่มีหัวหน้า",
      "สร้างรายการยืนยันหัวหน้าเมื่อมี off-site work ที่ต้องยืนยัน",
      "ยกเลิกเอกสารที่ยังไม่อนุมัติ",
    ],
  },
  {
    title: "Leader Verification",
    label: "การยืนยันหัวหน้า",
    icon: ClipboardCheck,
    events: [
      "แจ้งเตือนหัวหน้าภายใน",
      "ส่งอีเมลลิงก์ one-time token ให้หัวหน้าภายนอก",
      "หัวหน้าภายในยืนยันผ่าน Leader Queue",
      "หัวหน้าภายนอกยืนยันผ่าน public link",
      "เปลี่ยนคำขอเป็น WAIT_FOR_COLLECTION เมื่อยืนยันครบ",
    ],
  },
  {
    title: "Monthly Collection",
    label: "รวบรวมรายเดือน",
    icon: FolderOpen,
    events: [
      "เลือกคำขอที่พร้อมสำหรับเดือนนั้น",
      "กันรายการซ้ำเมื่อมี MRC ที่ยัง active ในเดือนเดียวกัน",
      "สร้าง MRC เป็น DRAFT",
      "แนบคำขอและเปลี่ยนคำขอเป็น COLLECTED",
      "ส่ง MRC เพื่อเปิดขั้น HPA_CHECK",
    ],
  },
  {
    title: "Approval / Output",
    label: "อนุมัติและออกเอกสาร",
    icon: ShieldCheck,
    events: [
      "ผู้ตรวจสอบต้องมีลายมือชื่อก่อนอนุมัติหรือปฏิเสธ",
      "HPA_CHECK อนุมัติแล้วเปิด RK_CHECK",
      "RK_CHECK อนุมัติแล้วเปิด OK_APPROVE",
      "OK_APPROVE อนุมัติแล้วเปลี่ยน MRC และคำขอเป็น APPROVED",
      "ปฏิเสธขั้นใดก็ได้เพื่อหยุด MRC และคืนคำขอเป็น WAIT_FOR_COLLECTION",
      "ยกเลิก MRC ก่อนมีขั้นที่อนุมัติแล้ว",
      "พิมพ์เอกสารพร้อมลายมือชื่อและประวัติการตรวจสอบ",
      "ส่ง notification ให้ผู้เกี่ยวข้องเมื่อสถานะสำคัญเปลี่ยน",
    ],
  },
];

const STATE_MACHINES = [
  "Expense claim document",
  "Monthly request collection",
] as const;

const TOTAL_EVENTS = EVENT_GROUPS.reduce(
  (total, group) => total + group.events.length,
  0,
);

const OVERVIEW_STATS = [
  {
    value: FLOW_STAGES.length,
    label: "Workflow stages",
    description: "ช่วงหลักตั้งแต่ผู้ใช้เริ่มงานจนถึงพิมพ์เอกสาร",
  },
  {
    value: STATE_MACHINES.length,
    label: "State machines",
    description: "สถานะของคำขอและรายการรวบรวมรายเดือน",
  },
  {
    value: APPROVAL_STAGES.length,
    label: "Approval steps",
    description: "หผ. ตรวจสอบ, รก. ตรวจสอบ, อก. อนุมัติ",
  },
  {
    value: TOTAL_EVENTS,
    label: "Possible events",
    description: "เหตุการณ์ที่ระบบอาจพบในกระบวนการใช้งาน",
  },
] as const;

const TONE_CLASS: Record<StatusItem["tone"], string> = {
  neutral: "border-border bg-muted/40 text-foreground",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function StatusPill({ status }: { status: StatusItem }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        TONE_CLASS[status.tone],
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-background/70 px-2 py-1 text-xs font-semibold">
          {status.code}
        </code>
        <span className="text-sm font-semibold">{status.label}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {status.description}
      </p>
    </div>
  );
}

export default function HowToUsePage() {
  return (
    <div className="bg-background">
      <section className="border-b border-border/40 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
            <div className="space-y-5">
              <Badge variant="outline" className="w-fit gap-2 rounded-full">
                <ClipboardList className="h-3.5 w-3.5" />
                คู่มือภาพรวมระบบ
              </Badge>
              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  วิธีใช้ระบบ / How to Use
                </h1>
                <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                  หน้านี้สรุปภาพรวมการทำงานของ Special Risk Allowance
                  Workflow ตั้งแต่บันทึกงานนอกพื้นที่ สร้างเอกสารเบิกจ่าย
                  ยืนยันโดยหัวหน้า รวบรวมรายเดือน อนุมัติ 3 ขั้น
                  ไปจนถึงพิมพ์เอกสารพร้อมลายมือชื่อ
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href={signInHref("/dashboard")}>เปิด Dashboard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={signInHref("/dashboard?tab=expense-claims")}>
                    เริ่มที่เอกสารเบิกจ่าย
                  </Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href={signInHref("/dashboard?tab=monthly-requests")}>
                    ดูรายการรายเดือน
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Archive className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">End-to-end flow</p>
                  <p className="text-sm text-muted-foreground">
                    Static guide, no data changes
                  </p>
                </div>
              </div>
              <Separator className="my-4" />
              <p className="text-sm leading-6 text-muted-foreground">
                ใช้หน้านี้เพื่อดูว่าเอกสารอยู่ตรงไหน ใครต้องทำอะไรต่อ
                และเหตุการณ์ใดทำให้สถานะเปลี่ยน
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {OVERVIEW_STATS.map((stat) => (
            <div key={stat.label} className="rounded-lg border p-4">
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold">{stat.label}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/40 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <div className="mb-8 max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Workflow Map
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              ระบบไหลจากคำสั่งงานไปสู่เอกสารอนุมัติ
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              แต่ละช่องเป็นจุดสำคัญของระบบ และลิงก์ไปยังพื้นที่ทำงานที่เกี่ยวข้อง
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {FLOW_STAGES.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <Link
                  key={stage.title}
                  href={stage.href}
                  className="group relative min-h-44 rounded-lg border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline">{stage.label}</Badge>
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold">
                    {stage.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {stage.description}
                  </p>
                  {index < FLOW_STAGES.length - 1 ? (
                    <div className="pointer-events-none absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rotate-45 border-r border-t border-border bg-background xl:block" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Role Lanes
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              ใครเกี่ยวข้องในขั้นตอนไหน
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              ใช้ role lanes เพื่อดูความรับผิดชอบหลักของแต่ละบทบาท
              โดยระบบจะควบคุมการมองเห็นและการกระทำด้วยสิทธิ์ผู้ใช้
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ROLE_LANES.map((lane) => {
              const Icon = lane.icon;
              return (
                <div key={lane.role} className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold">{lane.label}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {lane.role}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {lane.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-border/40 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <div className="mb-8 max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Status Legends
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              สถานะที่ผู้ใช้จะเห็นในระบบ
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              สถานะของคำขอและขั้นอนุมัติเป็นตัวบอกว่าต้องรอใคร
              หรือสามารถดำเนินการต่อได้แล้ว
            </p>
          </div>

          <div className="space-y-10">
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Expense Claim Status</h3>
                <Badge variant="secondary">
                  {EXPENSE_CLAIM_STATUSES.length} statuses
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {EXPENSE_CLAIM_STATUSES.map((status) => (
                  <StatusPill key={status.code} status={status} />
                ))}
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">MRC Approval Stages</h3>
                  <Badge variant="secondary">
                    {APPROVAL_STAGES.length} steps
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {APPROVAL_STAGES.map((status) => (
                    <StatusPill key={status.code} status={status} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Step Result Status</h3>
                  <Badge variant="secondary">{STEP_STATUSES.length} results</Badge>
                </div>
                <div className="grid gap-3">
                  {STEP_STATUSES.map((status) => (
                    <StatusPill key={status.code} status={status} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-12">
        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Possible Events
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              เหตุการณ์ที่อาจเกิดขึ้นทั้งหมด {TOTAL_EVENTS} รายการ
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              กลุ่มเหตุการณ์เหล่านี้คือสิ่งที่ทำให้ข้อมูล สถานะ การแจ้งเตือน
              และเอกสารปลายทางเปลี่ยนไป
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-sm">
            Computed from EVENT_GROUPS
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {EVENT_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="rounded-lg border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{group.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.title}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{group.events.length} events</Badge>
                </div>
                <Separator className="my-4" />
                <ol className="space-y-3">
                  {group.events.map((event, index) => (
                    <li key={event} className="flex gap-3 text-sm leading-6">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{event}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border/40 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-5">
              <Signature className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">ลายมือชื่อ</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                ผู้อนุมัติต้องมีลายมือชื่อที่ใช้งานอยู่ก่อนตรวจสอบรายการรายเดือน
              </p>
            </div>
            <div className="rounded-lg border bg-background p-5">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">ย้อนกลับเมื่อไม่ผ่าน</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                MRC ที่ถูกปฏิเสธหรือยกเลิกจะคืนคำขอที่เชื่อมไว้กลับไป
                WAIT_FOR_COLLECTION
              </p>
            </div>
            <div className="rounded-lg border bg-background p-5">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">แจ้งเตือนผู้เกี่ยวข้อง</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                ระบบส่ง notification ให้ผู้รวบรวม ผู้ยื่นคำขอ หัวหน้า
                และผู้ตรวจสอบตามเหตุการณ์สำคัญ
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-lg border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">พร้อมเริ่มใช้งานแล้วหรือยัง</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ไปที่ Dashboard แล้วเลือกแท็บตามบทบาทของคุณ
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href={signInHref("/dashboard")}>ไปที่ Dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={signInHref("/dashboard?tab=leader-queue")}>
                  เปิด Leader Queue
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
