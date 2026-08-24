import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  FileText,
  Flag,
  MapPin,
  Printer,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "วิธีใช้ระบบ | Special Risk Allowance Workflow",
  description: "คู่มือ workflow ค่าตอบแทนพิเศษสำหรับผู้ปฏิบัติงานเสี่ยงภัย",
};

interface Step {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

interface StateItem {
  code: string;
  title: string;
  description: string;
}

function signInHref(callbackUrl: string): string {
  return `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

const STEPS: Step[] = [
  {
    title: "จัดทำใบนำตัว",
    description:
      "ระบุช่วงวัน หัวหน้าชุด และ participant ที่เดินทางจริง ผู้สร้างหรือหัวหน้าจะไม่มีสิทธิ์เบิกโดยอัตโนมัติ",
    icon: MapPin,
    href: signInHref("/dashboard?tab=off-site-work"),
  },
  {
    title: "ทำคำขอรายเดือน",
    description:
      "หนึ่งคนมีคำขอที่ active ได้หนึ่งใบต่อเดือน แต่รวมหลายใบนำตัวได้ และแต่ละวันต้องเลือกใบนำตัวหลักเพียงหนึ่งใบ",
    icon: FileText,
    href: signInHref("/dashboard?tab=expense-claims"),
  },
  {
    title: "หัวหน้าชุดยืนยัน",
    description:
      "หัวหน้าเห็น snapshot ของผู้ขอ ใบนำตัว วันที่ We Safe จำนวนวัน และยอดเงิน ก่อนยืนยัน revision ทั้งชุดด้วยลายเซ็นออนไลน์",
    icon: ClipboardCheck,
    href: signInHref("/dashboard?tab=leader-queue"),
  },
  {
    title: "Collector ตรวจและรวบรวม",
    description:
      "ตรวจจากหน้า Recheck, Reject ให้แก้ไข, ติดธงน่าสงสัย หรือ Pass & Collect เข้าชุด Draft ของหน่วยงานและเดือน",
    icon: ShieldCheck,
    href: signInHref("/monthly-request-recheck"),
  },
  {
    title: "Finalize และออกเอกสาร",
    description:
      "Finalize เพื่อ freeze snapshot แล้วพิมพ์ฉบับจริงและ Export Excel; Draft พิมพ์ได้เฉพาะ preview ที่มี watermark",
    icon: Printer,
    href: signInHref("/dashboard?tab=monthly-requests"),
  },
  {
    title: "ลงนามกระดาษและ All Done",
    description:
      "Monthly Request เว้นช่องให้ หผ. ลงชื่อ ตราประทับชื่อ และวันที่ เมื่อ อก.ฝช. ยืนยันแล้ว Collector จึงบันทึก All Done",
    icon: CheckCircle2,
    href: signInHref("/dashboard?tab=monthly-requests"),
  },
];

const CLAIM_STATES: StateItem[] = [
  {
    code: "DRAFT",
    title: "ร่าง",
    description: "แก้ข้อมูลได้และยังไม่ส่งให้หัวหน้า",
  },
  {
    code: "PENDING_LEADER_CONFIRMATION",
    title: "รอหัวหน้ายืนยัน",
    description: "หัวหน้าของทุกใบนำตัวที่มีวันเบิกต้องยืนยัน revision ปัจจุบัน",
  },
  {
    code: "READY_FOR_COLLECTION",
    title: "พร้อมรวบรวม",
    description: "หัวหน้ายืนยันครบแล้ว รอ Collector ตรวจ",
  },
  {
    code: "COLLECTED",
    title: "รวบรวมแล้ว",
    description: "ถูกจองอยู่ใน Monthly Request Draft",
  },
  {
    code: "COMPLETED",
    title: "เสร็จสิ้น",
    description: "Monthly Request ถูกบันทึก All Done แล้ว",
  },
  {
    code: "REJECTED",
    title: "ต้องแก้ไข",
    description: "Collector ระบุเหตุผล ผู้ขอต้องสร้าง revision ใหม่และส่งยืนยันอีกครั้ง",
  },
  {
    code: "CANCELLED",
    title: "ยกเลิก",
    description: "ไม่นำคำขอนี้ไปดำเนินการต่อ",
  },
];

const MRC_STATES: StateItem[] = [
  {
    code: "DRAFT",
    title: "กำลังรวบรวม",
    description: "เพิ่มหรือถอดคำขอได้ และ preview จะมี watermark ทุกหน้า",
  },
  {
    code: "FINALIZED",
    title: "พร้อมส่งกระดาษ",
    description: "snapshot ถูก freeze แล้ว จึงพิมพ์ฉบับจริงและ Export Excel ได้",
  },
  {
    code: "ALL_DONE",
    title: "ดำเนินการครบ",
    description: "บันทึกวันเวลาที่ อก.ฝช. ยืนยันและผู้กด All Done แล้ว",
  },
  {
    code: "CANCELLED",
    title: "ยกเลิกร่าง",
    description: "คืนคำขอทั้งหมดไปพร้อมให้ Collector รวบรวมใหม่",
  },
  {
    code: "VOIDED",
    title: "ยกเลิกฉบับที่ออกแล้ว",
    description: "เก็บ snapshot เดิมเป็นประวัติและย้ายคำขอไป replacement Draft",
  },
];

const RULES = [
  {
    icon: CalendarCheck,
    title: "วันและอัตรา",
    text: "วันแรก/สุดท้ายของใบนำตัวเป็น TRAVEL; วันที่เหลือเป็น DUTY ทุกวันที่เบิกคิด 150.00 บาท โดยระบบคำนวณฝั่ง server เท่านั้น",
  },
  {
    icon: FileText,
    title: "We Safe",
    text: "TRAVEL, เสาร์–อาทิตย์ และวันหยุดราชการต้องมี We Safe อย่างน้อยหนึ่งเลข ความยาว 19 ตัว ระบบตรวจเพียงความยาว ไม่ตรวจความแท้จริง",
  },
  {
    icon: Flag,
    title: "รายการน่าสงสัย",
    text: "ธง OPEN ไม่เปลี่ยนสถานะคำขอ แต่จะบล็อกทั้ง Pass & Collect และ Finalize จน Collector Resolve พร้อมหมายเหตุ",
  },
  {
    icon: FileDown,
    title: "ข้อมูลปลายทาง",
    text: "Print และ Excel ฉบับจริงอ่านจาก snapshot เท่านั้น จึงดาวน์โหลดซ้ำได้ข้อมูลเดิมแม้โปรไฟล์ผู้ใช้เปลี่ยนภายหลัง",
  },
];

function StateGrid({ items }: { items: StateItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.code} className="rounded-lg border bg-card p-4">
          <code className="rounded bg-muted px-2 py-1 text-xs font-semibold">
            {item.code}
          </code>
          <h3 className="mt-3 font-semibold">{item.title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function HowToUsePage() {
  return (
    <main>
      <section className="border-b bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 py-14">
          <Badge variant="outline">คู่มือ workflow ปัจจุบัน</Badge>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            จากใบนำตัวสู่ Monthly Request ที่ลงนามจริงบนกระดาษ
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            การรับรองการปฏิบัติงานของหัวหน้าชุดยังทำออนไลน์ ส่วนการอนุมัติ
            Monthly Request ทำบนกระดาษนอกระบบ โดย Collector เป็นผู้ Finalize,
            ส่งออก และบันทึกผลสุดท้าย
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={signInHref("/dashboard")}>เปิด Dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={signInHref("/monthly-request-recheck")}>
                เปิดหน้า Recheck
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-12">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            End-to-end
          </p>
          <h2 className="mt-2 text-2xl font-bold">6 ขั้นตอนหลัก</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <Link
                  href={step.href}
                  className="block h-full rounded-lg border bg-card p-5 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="border-y bg-muted/20">
        <div className="container mx-auto max-w-7xl space-y-10 px-4 py-12">
          <div>
            <h2 className="text-2xl font-bold">สถานะคำขอเบิก</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              การแก้วัน ใบนำตัว หรือ We Safe หลัง Submit จะสร้าง revision ใหม่
              และทำให้การยืนยันเดิมเป็น Superseded
            </p>
          </div>
          <StateGrid items={CLAIM_STATES} />
          <Separator />
          <div>
            <h2 className="text-2xl font-bold">สถานะ Monthly Request</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              FINALIZED และ ALL_DONE ห้ามแก้ snapshot; หากต้องแก้ใช้ Void และ
              replacement batch เท่านั้น
            </p>
          </div>
          <StateGrid items={MRC_STATES} />
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold">กติกาที่ควรรู้</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {RULES.map((rule) => {
            const Icon = rule.icon;
            return (
              <div key={rule.title} className="rounded-lg border p-5">
                <Icon className="h-5 w-5" />
                <h3 className="mt-3 font-semibold">{rule.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {rule.text}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-8 rounded-lg border bg-card p-5">
          <div className="flex items-start gap-3">
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-semibold">ขอบเขตบทบาท</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Employee จัดการคำขอของตน, Leader เห็นเฉพาะ verification
                ของตน, Collector ตรวจได้ทุกหน่วยงานและจัดการ Monthly Request,
                ส่วน Admin มีสิทธิ์ manage-all โดยไม่มีสายอนุมัติ Monthly Request
                แบบออนไลน์
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
