const fs = require('fs');
const filepath = 'components/orders/OrdersView.tsx';
let content = fs.readFileSync(filepath, 'utf8');

const search = `  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.orderNumber.toLowerCase().includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        s.cashierName.toLowerCase().includes(q)
      );
    });
  }, [sales, search]);`;

const replace = `  // ⚡ Bolt Optimization: Memoize sales filtering to prevent O(n) recalculation on every render
  // and hoist string operations outside the loop to avoid redundant calculations.
  const filteredSales = useMemo(() => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return sales;
    const q = trimmedSearch.toLowerCase();
    return sales.filter(s => {
      return (
        s.orderNumber.toLowerCase().includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        s.cashierName.toLowerCase().includes(q)
      );
    });
  }, [sales, search]);`;

content = content.replace(search, replace);
fs.writeFileSync(filepath, content);
console.log("Patched correctly");
