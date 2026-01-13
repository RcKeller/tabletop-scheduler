import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ campaign: string }>;
}

/**
 * Legacy GM availability page - redirects to unified availability page
 */
export default async function Page({ params }: Props) {
  const { campaign: slug } = await params;
  redirect(`/${slug}/availability?role=gm`);
}
