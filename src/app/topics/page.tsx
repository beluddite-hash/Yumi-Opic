import TopicsView from "@/components/TopicsView";

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  return <TopicsView key={category} />;
}
