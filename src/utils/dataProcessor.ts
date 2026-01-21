export interface CostNode {
  name: string;
  level: number;
  cost: number; // Cost explicitly assigned to this node
  children: CostNode[];
  totalCost: number; // Aggregated cost
  color?: string;
}

export const processData = (data: any[]): CostNode => {
  const root: CostNode = {
    name: 'Total',
    level: 0,
    cost: 0,
    children: [],
    totalCost: 0,
  };

  const levelKeys = [
    '一级类目',
    '二级类目',
    '三级类目',
    '四级类目',
    '五级类目',
    '六级类目',
  ];

  data.forEach((row) => {
    let currentNode = root;
    const cost = parseFloat(row['成本']) || 0;

    for (let i = 0; i < levelKeys.length; i++) {
        const key = levelKeys[i];
      const name = row[key]?.toString().trim();

      if (!name || name === '') {
        // If current level is empty, stop branching for this row
        // The cost belongs to the last valid node
        break;
      }

      // Find or create child
      let child = currentNode.children.find((c) => c.name === name);
      if (!child) {
        child = {
          name: name,
          level: i + 1,
          cost: 0,
          children: [],
          totalCost: 0,
        };
        currentNode.children.push(child);
      }
      currentNode = child;
    }

    // Assign cost to the deepest node found in this row
    currentNode.cost += cost;
  });

  // Calculate totalCost recursively
  const calculateTotal = (node: CostNode): number => {
    const childrenSum = node.children.reduce((sum, child) => sum + calculateTotal(child), 0);
    node.totalCost = node.cost + childrenSum;
    return node.totalCost;
  };

  calculateTotal(root);

  return root;
};
