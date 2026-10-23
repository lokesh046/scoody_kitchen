import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Search, PawPrint, X, Clock, AlertCircle, Bone, Soup, Package, LayoutGrid } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { fetchProducts, fetchCategoryTree } from '../../api/products';
import type { CategoryTreeNode } from '../../api/products';
import type { ProductResponse } from '../../types/product';
import { Eyebrow } from '../../components/Eyebrow';
import { JournalCard } from '../../components/JournalCard';
import { RecipeCard } from '../../components/RecipeCard';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';

import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useFeatureFlag, useFeatureFlagFallback } from '../../hooks/useFeatureFlag';

// Round category badges get a simple line icon keyed off the category
// name, matching the bone/soup/box set from the original drill-down
// design -- there's no per-category image in the data yet.
function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('toy')) return Package;
  if (lower.includes('gravy') || lower.includes('wet')) return Soup;
  if (lower.includes('food') || lower.includes('dry')) return Bone;
  return PawPrint;
}

interface ExplorerTab {
  key: string;
  label: string;
  // null = no category filter (every product); otherwise merged across
  // all listed ids -- a parent's "All Items" tab spans every child since
  // the backend only filters by one category_id per request.
  categoryIds: number[] | null;
}

interface ExplorerEntry {
  key: string;
  label: string;
  icon: typeof PawPrint;
  tabs: ExplorerTab[];
}

function buildExplorerEntries(categoryTree: CategoryTreeNode[] | undefined): ExplorerEntry[] {
  if (!categoryTree) return [];

  const leafCategories = categoryTree.flatMap((cat) => (cat.children.length > 0 ? cat.children : [cat]));

  const allItems: ExplorerEntry = {
    key: 'all',
    label: 'All Items',
    icon: LayoutGrid,
    tabs: [
      { key: 'all', label: 'All Items', categoryIds: null },
      ...leafCategories.map((leaf) => ({ key: String(leaf.id), label: leaf.name, categoryIds: [leaf.id] })),
    ],
  };

  const categoryEntries: ExplorerEntry[] = categoryTree.map((cat) => ({
    key: String(cat.id),
    label: cat.name,
    icon: getCategoryIcon(cat.name),
    tabs:
      cat.children.length > 0
        ? [
            { key: 'all', label: 'All Items', categoryIds: cat.children.map((c) => c.id) },
            ...cat.children.map((c) => ({ key: String(c.id), label: c.name, categoryIds: [c.id] })),
          ]
        : [{ key: 'self', label: cat.name, categoryIds: [cat.id] }],
  }));

  return [allItems, ...categoryEntries];
}

// Fetches and merges products across one or more category ids (or
// everything, when null) -- one request per id via useQueries, since the
// backend only filters by a single category_id per call.
function useMergedProducts(categoryIds: number[] | null, search: string) {
  const ids = categoryIds && categoryIds.length > 0 ? categoryIds : [null];
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['products', 'explorer', id, search],
      queryFn: () => fetchProducts({ search: search || undefined, categoryId: id ?? undefined, limit: 9 }),
      staleTime: 1000 * 60 * 2,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
  const seen = new Set<number>();
  const items: ProductResponse[] = [];
  for (const r of results) {
    for (const p of r.data?.items ?? []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        items.push(p);
      }
    }
  }

  return { items, isLoading, isError };
}

// Smoothly animates height changes in its content instead of letting the
// panel snap/jump between e.g. a tall product grid and a single line of
// empty-state text -- that abrupt snap was reported as "flickering".
function AnimatedHeight({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h !== undefined) setHeight(h);
    });
    observer.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ height, transition: 'height 280ms cubic-bezier(0.16, 1, 0.3, 1)', overflow: 'hidden' }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function CategoryTabProducts({
  categoryKey,
  tabs,
  search,
  onAddToCart,
  orderingDisabledLabel,
}: {
  categoryKey: string;
  tabs: ExplorerTab[];
  search: string;
  onAddToCart: (productId: number) => Promise<void> | void;
  orderingDisabledLabel?: string;
}) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);

  // Reset to the first sub-tab when switching to a different main category
  // (not on every re-render of the same category, which would stomp the
  // user's current sub-tab choice).
  useEffect(() => {
    setActiveKey(tabs[0]?.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  const { items, isLoading, isError } = useMergedProducts(activeTab?.categoryIds ?? null, search);

  return (
    <div className="text-left">
      {tabs.length > 1 && (
        <div className="flex items-center gap-7 border-b border-cardboard pb-0 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveKey(tab.key)}
              onMouseEnter={() => setActiveKey(tab.key)}
              className={`font-body text-sm font-bold whitespace-nowrap pb-3 border-b-2 transition-colors ${
                (activeKey ?? tabs[0]?.key) === tab.key
                  ? 'text-paprika border-paprika'
                  : 'text-ink/50 border-transparent hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="border border-cardboard bg-paperLight rounded-[4px] animate-pulse aspect-[4/5]" />
          ))}
        </div>
      ) : isError ? (
        <p className="font-body text-xs text-paprika py-2">Couldn't load recipes for this category.</p>
      ) : items.length === 0 ? (
        <p className="font-body text-xs text-ink/60 italic py-6 text-center">
          Nothing stocked under this category yet — recipes are our focus for now.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((product) => (
            <RecipeCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              orderingDisabledLabel={orderingDisabledLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  useDocumentMetadata(
    "Shop Recipes",
    "Browse our small-batch recipes, active nutritional formulas, and veterinary-supervised meals cooked with transparent ingredients."
  );

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Which category's panel is shown below the badge row. Hovering sets it
  // temporarily (desktop); clicking pins it (touch, and desktop too once
  // clicked); with neither, it falls back to 'all' so "All Items" is open
  // by default, matching the reference design.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const openKey = hoveredKey ?? pinnedKey ?? 'all';

  const [isCartOpen, setIsCartOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const { user } = useAuthStore();
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const shopFallback = useFeatureFlagFallback('shop_checkout');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAddToCart = useCallback(async (productId: number) => {
    if (!isShopEnabled) return; // safety net — RecipeCard's own button is already disabled in this case
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await addItem(productId, 1);
    } catch (err) {
      console.error('Failed to add item to cart:', err);
    }
  }, [isShopEnabled, user, navigate, addItem]);

  const orderingDisabledLabel = isShopEnabled
    ? undefined
    : shopFallback === 'coming_soon'
    ? 'Coming Soon'
    : shopFallback === 'unavailable'
    ? 'Unavailable'
    : 'Ordering Unavailable';

  const { data: categoryTree, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categoryTree'],
    queryFn: fetchCategoryTree,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const explorerEntries = buildExplorerEntries(categoryTree);
  const activeEntry = explorerEntries.find((e) => e.key === openKey) ?? explorerEntries[0];

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="shop" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Landing Content */}
      <main className="flex-grow w-full">
        
        {/* Editorial Hero Section */}
        <section className="bg-gradient-to-br from-ink via-[#2E3C33] to-[#24352A] text-paper py-24 px-4 md:px-8 border-b border-cardboard relative overflow-hidden text-left mb-12">
          {/* Subtle blueprint graph background overlays */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#EBE0D0 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="absolute left-1/3 top-0 bottom-0 border-l border-dashed border-cardboard border-opacity-10 hidden md:block"></div>

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            <div className="lg:col-span-7 space-y-6 animate-fade-in-up">
              {/* Pulsing Active Ticker Badge */}
              <div className="inline-flex items-center space-x-2 bg-paperLight bg-opacity-5 border border-cardboard border-opacity-25 px-3 py-1.5 rounded-none select-none">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-turmeric">KITCHEN LEDGER BATCH: ONLINE & ACTIVE 🟢</span>
              </div>

              <div className="border-t border-b border-dashed border-cardboard border-opacity-30 py-4 space-y-4">
                <Eyebrow label="est. 2019 — batch ledger cooking" />
                <h1 className="font-display text-4xl md:text-6xl font-extrabold text-turmeric leading-tight tracking-tight">
                  Honest Ingredients.<br/>
                  <span className="text-paperLight italic font-normal">
                    Zero Filler Secrets.
                  </span>
                </h1>
              </div>

              <p className="font-body text-sm md:text-base text-paper opacity-85 leading-relaxed max-w-xl">
                We formulated Hearth & One because transparency shouldn't require a magnifying glass.
                We cook human-grade pet meals in documented small batches. No synthetic powders, 
                no rendering plant meals, and no hidden starches. Just real food prepared for families 
                who hold their dogs' nutrition to the same standards as their own.
              </p>

              <div className="pt-4 flex flex-wrap gap-4">
                <button 
                  onClick={() => {
                    const el = document.getElementById('product-ledger-heading');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-8 py-4 rounded-none tracking-wider transition-all shadow-sm active:translate-y-[1px] hover-bounce cursor-pointer"
                >
                  Explore Shop Recipes
                </button>
                <button
                  onClick={() => {
                    navigate('/#fit-calculator');
                    setTimeout(() => {
                      const el = document.getElementById('fit-calculator');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }}
                  className="border border-cardboard border-opacity-40 text-paper hover:bg-paperLight hover:bg-opacity-10 font-body font-bold text-xs uppercase px-8 py-4 rounded-none tracking-wider transition-colors flex items-center cursor-pointer"
                >
                  Configure My Dog's Diet
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 hover:scale-[1.02] hover:-rotate-1 transition-all duration-300 relative">
              <JournalCard
                tabLabel="DIAGNOSTIC NOTEBOOK"
                title="Kitchen Standard 01"
                stats={[
                  { label: 'HUMAN GRADE STATUS', value: '100% CERTIFIED' },
                  { label: 'BATCH LOG RECORDS', value: 'BLOCKCHAIN TRACEABLE' },
                  { label: 'REV. ARCHIVE COUNT', value: '400+ KITCHEN TRIALS' },
                  { label: 'TASTE COMPLIANCE', value: '100% TAIL WAG RATE' },
                ]}
              >
                "Every batch is cooked under the direct supervision of veterinary diet consultants, guaranteeing maximum bio-availability and zero allergen cross-contamination."
              </JournalCard>
            </div>
          </div>
        </section>

        {/* Centered Main Content Wrapper */}
        <div className="max-w-7xl w-full mx-auto px-4 md:px-8 py-8">

      {/* Shop / Feed Section */}
      <section className="space-y-8" id="product-ledger-heading">
        {!isShopEnabled && (
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-sm border font-mono text-xs font-bold ${
              shopFallback === 'coming_soon'
                ? 'bg-turmeric bg-opacity-10 border-turmeric text-turmeric'
                : 'bg-paprika bg-opacity-10 border-paprika text-paprika'
            }`}
          >
            {shopFallback === 'coming_soon' ? <Clock className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>
              {shopFallback === 'coming_soon'
                ? "Ordering isn't open yet — browse the catalog, but checkout is coming soon."
                : 'Ordering is temporarily unavailable. You can still browse the catalog.'}
            </span>
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-cardboard pb-6 gap-4">
          <div className="text-left">
            <h3 className="font-display text-2xl font-bold text-ink">
              The Product Ledger
            </h3>
            <p className="font-body text-xs text-ink opacity-70">
              Browse our small-batch recipes and active nutritional formulas.
            </p>
          </div>

          {/* Search Input */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipes (e.g. Chicken)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search recipes"
              className="w-full pl-9 pr-8 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cardboard hover:text-ink cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Explorer — round icon badges, moving the cursor over
            one shows its subcategories AND recipes right there, below the
            whole row, matching the reference design. "All Items" is open
            by default; hovering a different category swaps the panel to
            it; moving the mouse away (out of the badges+panel region
            entirely) falls back to "All Items" again. Tapping pins a
            choice open on touch, where there's no hover. */}
        <div
          className="space-y-5"
          onMouseLeave={() => setHoveredKey(null)}
        >
          <span className="font-mono text-[11px] uppercase tracking-wider text-paprika font-bold flex items-center">
            <PawPrint className="w-3 h-3 mr-1" /> Browse by Category
          </span>

          <div className="flex flex-nowrap items-start gap-8 md:gap-12 overflow-x-auto pb-1 -mx-1 px-1">
            {!categoriesLoading &&
              explorerEntries.map((entry) => {
                const isOpen = entry.key === openKey;
                const Icon = entry.icon;
                return (
                  <div
                    key={entry.key}
                    className="flex flex-col items-center gap-2 shrink-0"
                    onMouseEnter={() => setHoveredKey(entry.key)}
                  >
                    <button
                      onClick={() => setPinnedKey(entry.key)}
                      aria-label={entry.label}
                      aria-expanded={isOpen}
                      className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                        isOpen
                          ? 'bg-ink border-paprika shadow-md scale-105'
                          : 'bg-paperLight border-cardboard hover:border-paprika/50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 md:w-7 md:h-7 ${isOpen ? 'text-paperLight' : 'text-ink/70'}`} />
                    </button>
                    <span
                      className={`font-body text-[11px] font-bold uppercase text-center leading-tight ${
                        isOpen ? 'text-paprika' : 'text-ink/60'
                      }`}
                    >
                      {entry.label}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Shared panel — tabs + recipes for whichever category is open.
              No remount-on-switch key here on purpose: swapping categories
              now updates this one instance in place (reset via the
              categoryKey effect inside), and AnimatedHeight smooths the
              resulting height change instead of a jarring snap. */}
          {activeEntry && (
            <AnimatedHeight>
              <CategoryTabProducts
                categoryKey={activeEntry.key}
                tabs={activeEntry.tabs}
                search={debouncedSearch}
                onAddToCart={handleAddToCart}
                orderingDisabledLabel={orderingDisabledLabel}
              />
            </AnimatedHeight>
          )}
        </div>
      </section>
      </div>
      </main>
      {/* Footer */}
      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 w-full">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
          © {new Date().getFullYear()} Hearth & One. All rights reserved. ·{' '}
          <Link to="/privacy" className="hover:text-turmeric hover:opacity-100 transition-colors">Privacy Policy</Link>{' '}
          · <Link to="/terms" className="hover:text-turmeric hover:opacity-100 transition-colors">Terms & Conditions</Link>
        </p>
        <p className="font-body text-xs mt-1 max-w-md mx-auto leading-relaxed">
          Tested and crafted with love for pet parents who care about what goes in the bowl.
        </p>
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
