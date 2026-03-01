import { listOffSiteWorks } from "@/app/actions/off-site-work";
import { OffSiteWorkClient } from "./off-site-work-client";

export default async function OffSiteWorkPage() {
  const result = await listOffSiteWorks({ page: 1, pageSize: 50 });

  const data = result.success
    ? { items: result.data.data, pagination: result.data.pagination }
    : { items: [], pagination: null };

  return (
    <OffSiteWorkClient
      initialItems={data.items}
      initialPagination={data.pagination}
    />
  );
}
