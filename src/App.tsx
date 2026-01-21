import { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { processData, type CostNode } from './utils/dataProcessor';
import ThreeTree from './components/ThreeTree';
import './App.css';

interface CategoryOption {
  level: number;
  name: string;
  path: string[];
  node: CostNode;
}

function App() {
  const [data, setData] = useState<CostNode | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('root');

  useEffect(() => {
    Papa.parse('/data.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const tree = processData(results.data);
        setData(tree);
      },
      error: (err) => {
        console.error('Error parsing CSV:', err);
      }
    });
  }, []);

  // Extract all categories from level 1 to 3
  const categoryOptions = useMemo(() => {
    if (!data) return [];

    const options: CategoryOption[] = [
      { level: 0, name: '全部（根节点）', path: [], node: data }
    ];

    const extractCategories = (node: CostNode, path: string[] = []) => {
      if (node.level >= 1 && node.level <= 3 && node.totalCost > 0) {
        const currentPath = [...path, node.name];
        options.push({
          level: node.level,
          name: currentPath.join(' > '),
          path: currentPath,
          node: node
        });
      }

      if (node.level < 3) {
        node.children.forEach(child => {
          extractCategories(child, [...path, node.name]);
        });
      }
    };

    // Start from root's children (level 1)
    data.children.forEach(child => {
      extractCategories(child, []);
    });

    return options;
  }, [data]);

  // Get the filtered data based on selected category
  const displayData = useMemo(() => {
    if (!data || selectedCategory === 'root') {
      return data;
    }

    const selectedOption = categoryOptions.find(opt => opt.name === selectedCategory);
    if (!selectedOption) return data;

    // Create a new root node with the selected node as the only child
    return {
      name: 'Root',
      level: 0,
      cost: 0,
      children: [selectedOption.node],
      totalCost: selectedOption.node.totalCost
    };
  }, [data, selectedCategory, categoryOptions]);

  // Always keep the original total cost for display
  const rootTotalCost = data?.totalCost || 0;

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f5f7fa' }}>
        {!data && (
          <div style={{
            color: '#333',
            paddingTop: '20px',
            textAlign: 'center',
            fontSize: '1.2rem'
          }}>
            Loading Data...
          </div>
        )}

        {data && (
          <>
            {/* Category Selector */}
            <div style={{
              position: 'absolute',
              top: '30px',
              right: '30px',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              padding: '20px 25px',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              minWidth: '300px'
            }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '1.5px',
                color: '#6366f1',
                marginBottom: '12px',
                textTransform: 'uppercase',
                fontFamily: "'Inter', sans-serif"
              }}>
                Category Filter
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <select
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: '0.95rem',
                    fontFamily: "'Inter', sans-serif",
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    background: 'white',
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    fontWeight: 500
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  {categoryOptions.map((option, index) => {
                    const indent = option.level === 0 ? '' : '　'.repeat(option.level - 1) + '├─ ';
                    const displayName = option.level === 0 ? option.name : option.path[option.path.length - 1];
                    const costStr = option.node.totalCost > 0 ? ` (¥${option.node.totalCost.toLocaleString()})` : '';

                    return (
                      <option key={index} value={option.name}>
                        {indent}{displayName}{costStr}
                      </option>
                    );
                  })}
                </select>

                {selectedCategory !== 'root' && (
                  <button
                    onClick={() => setSelectedCategory('root')}
                    style={{
                      padding: '0 16px',
                      fontSize: '0.9rem',
                      fontFamily: "'Inter', sans-serif",
                      border: '2px solid #ef4444',
                      borderRadius: '10px',
                      background: 'white',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ef4444';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {selectedCategory !== 'root' && (
                <>
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    Showing: Level {categoryOptions.find(opt => opt.name === selectedCategory)?.level} Category
                  </div>

                  {(() => {
                    const selected = categoryOptions.find(opt => opt.name === selectedCategory);
                    if (!selected) return null;

                    return (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: '#64748b',
                        lineHeight: 1.6
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span>Total Cost:</span>
                          <span style={{ fontWeight: 700, color: '#1a1a1a' }}>
                            ¥{selected.node.totalCost.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span>Direct Cost:</span>
                          <span style={{ fontWeight: 700, color: '#1a1a1a' }}>
                            ¥{selected.node.cost.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Sub-categories:</span>
                          <span style={{ fontWeight: 700, color: '#6366f1' }}>
                            {selected.node.children.length}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <ThreeTree data={displayData} rootTotalCost={rootTotalCost} />
          </>
        )}
    </div>
  );
}

export default App;
