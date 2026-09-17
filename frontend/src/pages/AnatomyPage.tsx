import { HumanAtlasView } from '@/components/human-atlas/HumanAtlas';

export function AnatomyPage() {
  return <section className="flex flex-col gap-3">
    <div><h1 className="text-xl font-semibold text-white">Human Atlas</h1>
      <p className="mt-1 text-sm text-slate-400">Explore anatomy with search, system layers and the exploded view. To locate a report finding, open the 3D Atlas from its QA result in the clinical workspace.</p></div>
    <div className="overflow-hidden rounded-xl border border-slate-700" style={{height:'calc(100dvh - 180px)',minHeight:520}}><HumanAtlasView/></div>
  </section>;
}
