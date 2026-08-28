import { jsonRequest } from "@/lib/api-client";

type JobPostingSummaryResponse = {
  summary: string;
};

/** 募集要項 URL の内容を要約する。要約の保存は企業情報 API が担う。 */
export async function summarizeJobPosting(companyUrl: string): Promise<string> {
  const response = await jsonRequest<JobPostingSummaryResponse>(
    "/job-postings/summary",
    "POST",
    { company_url: companyUrl },
  );
  return response.summary;
}
