import AnalysisView from "./AnalysisView";

interface Props {
  params: Promise<{ gameId: string }>;
}

export default async function AnalyzePage({ params }: Props) {
  const { gameId } = await params;
  return <AnalysisView gameId={gameId} />;
}
