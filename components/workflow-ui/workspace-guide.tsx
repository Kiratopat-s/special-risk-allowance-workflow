import {
  FileText,
  LayoutGrid,
  MapPin,
  FolderOpen,
  Check,
  PenLine,
} from "lucide-react";
/** Static illustration of the real navigation and claim steps; never contains live or invented records. */
export function WorkspaceGuide() {
  return (
    <figure
      className="document-panel overflow-hidden"
      aria-label="ภาพประกอบเมนูด้านข้างและขั้นตอนสร้างเอกสารสามขั้น"
    >
      <div className="flex min-h-72">
        <div className="bg-[#202535] text-white w-40 p-4 shrink-0 hidden sm:block">
          <div className="font-bold text-base mb-7">
            s. <span className="ml-2">SRAW</span>
          </div>
          <div className="space-y-2 text-[10px]">
            {[
              [LayoutGrid, "ภาพรวม"],
              [FileText, "เอกสารเบิกค่าใช้จ่าย"],
              [MapPin, "คำสั่งออกนอกสถานที่"],
              [FolderOpen, "รวบรวมรายเดือน"],
              [PenLine, "ลายมือชื่อของฉัน"],
            ].map(([Icon, label], i) => {
              const Mark = Icon as typeof FileText;
              return (
                <div
                  className={`flex items-center gap-2 p-2 rounded ${i === 1 ? "bg-[#ce4933]" : "text-white/60"}`}
                  key={String(label)}
                >
                  <Mark size={12} />
                  {String(label)}
                </div>
              );
            })}
          </div>
        </div>
        <div className="min-w-0 flex-1 p-5 sm:p-7">
          <p className="eyebrow">CREATE A CLAIM</p>
          <h3 className="text-lg font-bold">สร้างเอกสารเบิกค่าใช้จ่าย</h3>
          <ol className="mt-6 space-y-4">
            {[
              [
                "เดือน / งาน / วันที่",
                "เลือกเดือน คำสั่ง และวันที่ปฏิบัติงานแต่ละวัน",
              ],
              ["ข้อมูลผู้เบิก", "ตรวจสอบตำแหน่งที่บันทึกไว้ และระบุหมายเหตุ"],
              [
                "ตรวจสอบและส่ง",
                "ทบทวนจำนวนวันและยอดเบิก แล้วบันทึกร่างหรือส่ง",
              ],
            ].map(([title, description], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex items-center justify-center size-7 shrink-0 rounded-full border text-xs text-primary font-bold">
                  {i < 2 ? <Check size={14} /> : "3"}
                </span>
                <div>
                  <p className="text-xs font-bold">{title}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="border-t p-3 text-center text-[11px] text-muted-foreground">
        ภาพประกอบการใช้งาน · เมนูและการดำเนินการขึ้นอยู่กับสิทธิ์ของบัญชี
      </figcaption>
    </figure>
  );
}
