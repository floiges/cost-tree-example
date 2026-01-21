import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { CostNode } from '../utils/dataProcessor';

extend(THREE);

// Modern color scheme - gradient from deep blue to gold representing cost flow
const getCostColor = (ratio: number, isLeaf = false): string => {
    if (isLeaf) {
        // Leaves: gradient from green (low) to orange/red (high)
        if (ratio > 0.15) return '#ff6b6b'; // High cost - red
        if (ratio > 0.08) return '#ffa94d'; // Medium-high - orange
        if (ratio > 0.04) return '#ffd43b'; // Medium - yellow
        if (ratio > 0.02) return '#a9e34b'; // Low-medium - lime
        return '#69db7c'; // Low - green
    }

    // Branches: gradient from deep purple (root) to lighter blue
    if (ratio > 0.3) return '#6366f1'; // High - indigo
    if (ratio > 0.15) return '#8b5cf6'; // Medium-high - purple
    if (ratio > 0.08) return '#a78bfa'; // Medium - light purple
    return '#c4b5fd'; // Low - very light purple
};

const getEmissiveIntensity = (ratio: number): number => {
    // Higher cost items glow more
    return Math.min(0.3 + ratio * 2, 0.8);
};

interface BranchProps {
  node: CostNode;
  radius: number;
  length: number;
  level: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  parentCost: number; // Parent's total cost for calculating percentage
  rootCost: number; // Root's total cost for global context
  onNodeClick: (node: CostNode) => void; // Click handler
}

const Branch: React.FC<BranchProps> = ({
  node,
  radius,
  length,
  level,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  parentCost,
  rootCost,
  onNodeClick
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate cost ratios for visual representation
  const localRatio = node.totalCost / parentCost; // Ratio relative to parent
  const globalRatio = node.totalCost / rootCost; // Ratio relative to root
  const percentage = (localRatio * 100).toFixed(1);

  // Handle click event
  const handleClick = (e: any) => {
    e.stopPropagation();
    onNodeClick(node);
  };

  // Debounced hover handlers to prevent jitter
  const handlePointerEnter = (e: any) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHover(true);
  };

  const handlePointerLeave = (e: any) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHover(false);
    }, 50);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Animate gentle pulse and flow effect
  useFrame((state) => {
      if (meshRef.current?.material) {
          const t = state.clock.getElapsedTime();
          const mat = meshRef.current.material as THREE.MeshStandardMaterial;
          if (mat.emissiveIntensity !== undefined) {
             // Pulsing glow effect based on cost importance
             const baseIntensity = getEmissiveIntensity(globalRatio);
             const pulse = Math.sin(t * 1.5 + level * 0.5) * 0.1;
             mat.emissiveIntensity = hovered ? baseIntensity + 0.5 : baseIntensity + pulse;
          }
      }
  });

  const validChildren = useMemo(() => node.children.filter(c => c.totalCost > 0), [node]);
  const isLeaf = validChildren.length === 0;

  // Visual tweaks: Thinner branches for elegance
  const radiusTop = radius * 0.65;

  const childBranches = useMemo(() => {
    if (isLeaf) return null;

    const branches: React.ReactElement[] = [];
    const spreadFactor = Math.max(0.5, 2.5 - level * 0.3);

    validChildren.sort((a, b) => b.totalCost - a.totalCost);

    validChildren.forEach((child, index) => {
      const ratio = Math.sqrt(child.totalCost / node.totalCost);
      const childRadius = radiusTop * ratio * 1.2; // Slightly exaggerate for visibility

      const childLength = length * 0.8;

      // Golden angle distribution
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const spin = index * goldenAngle;

      const tiltBase = Math.PI / 4;
      const tilt = tiltBase + (Math.random() * 0.3 - 0.15);

      branches.push(
        <group key={`${child.name}-${index}`} rotation={[0, spin, 0]} position={[0, length, 0]}>
              <group rotation={[tilt, 0, 0]}>
                  <Branch
                    node={child}
                    radius={childRadius}
                    length={childLength}
                    level={level + 1}
                    parentCost={node.totalCost}
                    rootCost={rootCost}
                    onNodeClick={onNodeClick}
                  />
              </group>
        </group>
      );
    });

    return branches;
  }, [validChildren, radiusTop, length, level, node.totalCost, isLeaf, rootCost]);

  // --- LEAF RENDERING ---
  if (isLeaf) {
    const leafScale = Math.max(1.2, Math.min(4, radius * 12 * Math.sqrt(globalRatio) * 6));
    const leafColor = getCostColor(globalRatio, true);
    const stemLength = length * 0.4; // Connecting stem

    return (
        <group position={position} rotation={rotation as any}>
          {/* Connecting stem to make leaf-branch connection clear */}
          <mesh
            position={[0, stemLength / 2, 0]}
            castShadow
          >
            <cylinderGeometry args={[radius * 0.3, radius, stemLength, 8]} />
            <meshStandardMaterial
                color={leafColor}
                emissive={leafColor}
                emissiveIntensity={0.2}
                roughness={0.5}
                metalness={0.5}
            />
          </mesh>

          {/* Leaf sphere */}
          <mesh
            ref={meshRef}
            position={[0, stemLength + leafScale * 0.5, 0]}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            onClick={handleClick}
            castShadow
          >
            <sphereGeometry args={[leafScale, 20, 20]} />
            <meshStandardMaterial
                color={hovered ? '#ffffff' : leafColor}
                emissive={leafColor}
                emissiveIntensity={hovered ? 1.2 : getEmissiveIntensity(globalRatio)}
                roughness={0.2}
                metalness={0.8}
            />
          </mesh>

          {/* Glow ring effect on hover */}
          {hovered && (
            <mesh position={[0, stemLength + leafScale * 0.5, 0]}>
              <ringGeometry args={[leafScale * 1.2, leafScale * 1.5, 32]} />
              <meshBasicMaterial
                color={leafColor}
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}

          {/* Name label for leaves - always show with dynamic font size */}
          <Billboard
            follow={true}
            lockX={false}
            lockY={false}
            lockZ={false}
            position={[0, stemLength + leafScale * 1.5 + 1.5, 0]}
          >
            <Text
              fontSize={Math.max(0.6, Math.min(1.2, leafScale * 0.4))}
              color="#1a1a1a"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.08}
              outlineColor="#ffffff"
              fontWeight={600}
              maxWidth={10}
              overflowWrap="break-word"
            >
              {node.name}
            </Text>
          </Billboard>

          {/* Enhanced Tooltip */}
          {hovered && (
               <Html distanceFactor={15} center position={[0, stemLength + leafScale * 1.5 + 3, 0]} style={{ pointerEvents: 'none' }}>
                <div className="tooltip-container tooltip-large">
                  <div className="tooltip-title">{node.name}</div>
                  <div className="tooltip-divider"></div>
                  <div className="tooltip-row">
                      <span>Cost:</span>
                      <span className="tooltip-value">¥{node.cost.toLocaleString()}</span>
                  </div>
                  <div className="tooltip-row">
                      <span>Percentage:</span>
                      <span className="tooltip-value tooltip-percentage">{percentage}%</span>
                  </div>
                  <div className="tooltip-badge">LEAF NODE</div>
                </div>
              </Html>
          )}
        </group>
    );
  }

  // --- BRANCH RENDERING ---
  const branchColor = getCostColor(localRatio, false);

  return (
    <group position={position} rotation={rotation as any}>
      <mesh
        ref={meshRef}
        position={[0, length / 2, 0]}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[radiusTop, radius, length, 16]} />
        <meshStandardMaterial
            color={hovered ? '#ffffff' : branchColor}
            emissive={branchColor}
            emissiveIntensity={hovered ? 0.8 : 0}
            roughness={0.4}
            metalness={0.7}
        />
      </mesh>

      {/* Glow ring effect on hover for branches */}
      {hovered && (
        <>
          <mesh position={[0, length, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radiusTop * 1.5, radiusTop * 2, 32]} />
            <meshBasicMaterial
              color={branchColor}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius * 1.5, radius * 2, 32]} />
            <meshBasicMaterial
              color={branchColor}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      {/* Name label for major branches */}
      {localRatio > 0.08 && level < 5 && (
        <Billboard
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
          position={[0, length + 1, 0]}
        >
          <Text
            fontSize={1}
            color="#1a1a1a"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.12}
            outlineColor="#ffffff"
            fontWeight={700}
          >
            {node.name}
          </Text>
        </Billboard>
      )}

      {/* Enhanced Tooltip */}
      {hovered && (
           <Html distanceFactor={15} center position={[0, length / 2, 0]} style={{ pointerEvents: 'none' }}>
            <div className="tooltip-container tooltip-large">
              <div className="tooltip-title">{node.name}</div>
              <div className="tooltip-divider"></div>
              <div className="tooltip-row">
                  <span>Direct Cost:</span>
                  <span className="tooltip-value">¥{node.cost.toLocaleString()}</span>
              </div>
              <div className="tooltip-row">
                  <span>Total Cost:</span>
                  <span className="tooltip-value">¥{node.totalCost.toLocaleString()}</span>
              </div>
              <div className="tooltip-row">
                  <span>Percentage:</span>
                  <span className="tooltip-value tooltip-percentage">{percentage}%</span>
              </div>
              <div className="tooltip-row">
                  <span>Children:</span>
                  <span className="tooltip-value">{validChildren.length}</span>
              </div>
              <div className="tooltip-badge">BRANCH NODE</div>
            </div>
          </Html>
      )}

      {childBranches}
    </group>
  );
};

interface ThreeTreeProps {
  data: CostNode | null;
  rootTotalCost: number;
}

interface NodeDetailPanelProps {
  node: CostNode;
  rootTotalCost: number;
  onClose: () => void;
}

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ node, rootTotalCost, onClose }) => {
  const percentage = ((node.totalCost / rootTotalCost) * 100).toFixed(2);
  const isLeaf = node.children.length === 0;

  return (
    <div style={{
      position: 'absolute',
      top: '30px',
      right: '30px',
      zIndex: 1000,
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(16px)',
      padding: '25px 30px',
      borderRadius: '16px',
      boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15)',
      border: '2px solid rgba(99, 102, 241, 0.3)',
      minWidth: '320px',
      maxWidth: '400px',
      fontFamily: "'Inter', -apple-system, sans-serif",
      animation: 'slideIn 0.3s ease-out'
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '15px',
          right: '15px',
          width: '32px',
          height: '32px',
          border: 'none',
          borderRadius: '8px',
          background: '#fee',
          color: '#ef4444',
          cursor: 'pointer',
          fontSize: '1.2rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#ef4444';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fee';
          e.currentTarget.style.color = '#ef4444';
        }}
      >
        ×
      </button>

      {/* Header */}
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '1.5px',
        color: '#6366f1',
        marginBottom: '12px',
        textTransform: 'uppercase'
      }}>
        Node Details
      </div>

      {/* Node Type Badge */}
      <div style={{
        display: 'inline-block',
        padding: '4px 12px',
        background: isLeaf ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: 'white',
        borderRadius: '6px',
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '1px',
        marginBottom: '15px'
      }}>
        {isLeaf ? '🍃 LEAF NODE' : '🌿 BRANCH NODE'}
      </div>

      {/* Node Name */}
      <div style={{
        fontSize: '1.4rem',
        fontWeight: 700,
        color: '#1a1a1a',
        marginBottom: '20px',
        lineHeight: 1.3,
        wordBreak: 'break-word'
      }}>
        {node.name}
      </div>

      {/* Divider */}
      <div style={{
        height: '2px',
        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.4), transparent)',
        marginBottom: '20px',
        borderRadius: '2px'
      }}></div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>Level:</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' }}>
            {node.level}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>Direct Cost:</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', fontFamily: 'monospace' }}>
            ¥{node.cost.toLocaleString()}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>Total Cost:</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6366f1', fontFamily: 'monospace' }}>
            ¥{node.totalCost.toLocaleString()}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>Percentage:</span>
          <span style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: '#10b981',
            fontFamily: 'monospace'
          }}>
            {percentage}%
          </span>
        </div>

        {!isLeaf && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>Children:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#8b5cf6' }}>
              {node.children.length}
            </span>
          </div>
        )}

        {!isLeaf && (
          <>
            {/* Children List */}
            <div style={{
              marginTop: '10px',
              padding: '15px',
              background: '#f8fafc',
              borderRadius: '10px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Sub-categories
              </div>
              {node.children.map((child, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 10px',
                    background: 'white',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <span style={{ color: '#374151', fontWeight: 500 }}>{child.name}</span>
                  <span style={{ color: '#6366f1', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    ¥{child.totalCost.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer Hint */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
        borderRadius: '8px',
        fontSize: '0.75rem',
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 1.5
      }}>
        💡 Click the node again or press × to close
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

const UIOverlay: React.FC<{ data: CostNode; rootTotalCost: number }> = ({ data, rootTotalCost }) => {
    return (
        <div style={{
            position: 'absolute',
            top: '30px',
            left: '30px',
            color: '#1a1a1a',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            pointerEvents: 'none',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
            padding: '25px 30px',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            maxWidth: '320px'
        }}>
            <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '1.5px',
                color: '#6366f1',
                marginBottom: '15px',
                textTransform: 'uppercase'
            }}>
                Cost Flow Visualization
            </div>

            <div style={{ marginBottom: '25px' }}>
                <div style={{
                    fontSize: '0.7rem',
                    color: '#6b7280',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    Total Project Cost
                </div>
                <div style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: '#1a1a1a',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '5px'
                }}>
                    <span style={{ fontSize: '1.2rem', color: '#6366f1' }}>¥</span>
                    {rootTotalCost.toLocaleString()}
                </div>
            </div>

            <div style={{
                borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                paddingTop: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#6b7280',
                    marginBottom: '5px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                }}>
                    Legend
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '30px',
                        height: '4px',
                        background: 'linear-gradient(90deg, #c4b5fd, #6366f1)',
                        borderRadius: '2px'
                    }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                        Cost Flow (Light to Dark)
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '10px',
                        height: '10px',
                        background: 'linear-gradient(135deg, #69db7c, #ff6b6b)',
                        borderRadius: '50%',
                        boxShadow: '0 2px 8px rgba(255, 107, 107, 0.3)'
                    }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                        Cost Items (Size = Amount)
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#1a1a1a',
                        background: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                    }}>
                        Name
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                        Category Labels
                    </span>
                </div>
            </div>

            <div style={{
                marginTop: '20px',
                fontSize: '0.7rem',
                color: '#9ca3af',
                lineHeight: 1.5,
                borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                paddingTop: '15px'
            }}>
                <div>• Hover for detailed breakdown</div>
                <div>• Branch thickness = cost weight</div>
                <div>• Labels show category names</div>
            </div>
        </div>
    );
};

const ThreeTree: React.FC<ThreeTreeProps> = ({ data, rootTotalCost }) => {
  if (!data) return null;

  const rootRadius = 2.5;
  const [selectedNode, setSelectedNode] = useState<CostNode | null>(null);

  const handleNodeClick = (node: CostNode) => {
    // Toggle: if clicking the same node, deselect it
    if (selectedNode?.name === node.name && selectedNode?.level === node.level) {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  };

  return (
    <>
        <Canvas
          dpr={[1, 2]}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2
          }}
          shadows
        >
        <PerspectiveCamera makeDefault position={[0, 35, 100]} fov={50} />
        <OrbitControls
            makeDefault
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.1}
            maxDistance={200}
            minDistance={15}
            enableDamping
            dampingFactor={0.08}
            autoRotate
            autoRotateSpeed={0.5}
        />

        {/* Modern gradient sky */}
        <color attach="background" args={['#f0f4f8']} />
        <fog attach="fog" args={['#f0f4f8', 80, 250]} />

        {/* Enhanced lighting for better visibility */}
        <ambientLight intensity={0.6} />
        <directionalLight
            position={[40, 80, 40]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-far={200}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={50}
            shadow-camera-bottom={-50}
        />
        <directionalLight
            position={[-40, 60, -40]}
            intensity={0.4}
            color="#a78bfa"
        />
        <hemisphereLight intensity={0.4} groundColor="#e0e7ff" color="#ffffff" />

        <group position={[0, -35, 0]}>
            {/* Modern ground plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[400, 400]} />
                <meshStandardMaterial
                  color="#e0e7ff"
                  roughness={0.8}
                  metalness={0.2}
                />
            </mesh>

            {/* Tree visualization */}
             {data.children.length === 1 ? (
                 <Branch
                    node={data.children[0]}
                    radius={rootRadius}
                    length={20}
                    level={1}
                    parentCost={data.totalCost}
                    rootCost={data.totalCost}
                    onNodeClick={handleNodeClick}
                />
            ) : (
                data.children.map((child, i) => (
                    <group key={i} rotation={[0, (i / data.children.length) * Math.PI * 2, 0]}>
                        <group rotation={[Math.PI / 6, 0, 0]}>
                            <Branch
                                node={child}
                                radius={rootRadius * Math.sqrt(child.totalCost / data.totalCost)}
                                length={20}
                                level={1}
                                parentCost={data.totalCost}
                                rootCost={data.totalCost}
                                onNodeClick={handleNodeClick}
                            />
                        </group>
                    </group>
                ))
            )}
        </group>
        </Canvas>

        {/* UI Overlay */}
        <UIOverlay data={data} rootTotalCost={rootTotalCost} />

        {/* Node Detail Panel */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            rootTotalCost={rootTotalCost}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Modern Tooltip Styles */}
        <style>{`
            .tooltip-container {
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid rgba(99, 102, 241, 0.3);
                padding: 16px 20px;
                border-radius: 16px;
                pointer-events: none;
                backdrop-filter: blur(16px);
                box-shadow: 0 12px 48px rgba(99, 102, 241, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.5);
                min-width: 200px;
                color: #1a1a1a;
                font-family: 'Inter', -apple-system, sans-serif;
                transition: all 0.2s ease;
            }
            .tooltip-large {
                min-width: 280px;
                padding: 20px 24px;
            }
            .tooltip-title {
                font-weight: 700;
                color: #6366f1;
                margin-bottom: 12px;
                font-size: 1.25rem;
                letter-spacing: -0.02em;
                text-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
            }
            .tooltip-divider {
                height: 2px;
                background: linear-gradient(90deg, rgba(99, 102, 241, 0.4), transparent);
                margin-bottom: 12px;
                border-radius: 2px;
            }
            .tooltip-row {
                display: flex;
                justify-content: space-between;
                font-size: 0.95rem;
                color: #6b7280;
                margin-bottom: 8px;
                gap: 24px;
                align-items: center;
            }
            .tooltip-row:last-of-type {
                margin-bottom: 0;
            }
            .tooltip-value {
                color: #1a1a1a;
                font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
                font-weight: 600;
                font-size: 1rem;
            }
            .tooltip-percentage {
                color: #6366f1;
                font-weight: 700;
                font-size: 1.15rem;
            }
            .tooltip-badge {
                margin-top: 12px;
                padding: 6px 12px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                text-align: center;
                border-radius: 8px;
                font-size: 0.7rem;
                font-weight: 700;
                letter-spacing: 1px;
                text-transform: uppercase;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            }
        `}</style>
    </>
  );
};

export default ThreeTree;
