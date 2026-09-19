'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  RotateCcw,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import type { Product, Category, Location, User as StaffUser } from '@/lib/types';
import { bulkImportInventoryFromCSV, type CSVInventoryRow } from '@/lib/services/inventoryService';
import { sound } from '@/lib/audio';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  currentLocation: Location;
  currentUser: StaffUser;
  onSuccess: () => Promise<void>;
}

// RFC-4180 compliant CSV parser helper
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote inside quotes
          currentVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        // Skip CR in CRLF
        if (nextChar === '\n') i++;
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c.length > 0)) lines.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c.length > 0)) lines.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(c => c.length > 0)) lines.push(currentRow);
  }

  return lines;
}

// Normalize column header strings
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  products,
  categories,
  currentLocation,
  currentUser,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<CSVInventoryRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [stockUpdateMode, setStockUpdateMode] = useState<'SET_ABSOLUTE' | 'ADD_TO_EXISTING'>('SET_ABSOLUTE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    updated: number;
  } | null>(null);

  // Map of existing products by SKU & Barcode for instant comparison
  const existingSkuMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p.sku) map.set(p.sku.toLowerCase().trim(), p);
    });
    return map;
  }, [products]);

  // Generate and trigger download for sample CSV
  const handleDownloadTemplate = () => {
    sound.playClick();
    const sampleHeaders = 'sku,name,barcode,category,brand,unit,cost,price,stock,min_stock,description';
    const sampleRows = [
      'COF-ESP-01,Organic Espresso Beans,8901230001,cat_coffee,Nexora Origin,bag,6.50,14.00,45,10,Single origin Ethiopian roast',
      'PAST-CROIS-01,Butter Almond Croissant,8901230002,cat_bakery,Artisan Hearth,piece,1.20,3.75,30,8,Freshly baked daily morning batch',
      'ACC-MUG-CER,Nexora Matte Ceramic Mug,8901230003,cat_retail,Nexora Studio,piece,4.50,16.00,20,5,350ml heat insulated ceramic mug',
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [sampleHeaders, ...sampleRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'nexora_inventory_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process raw CSV text into typed rows
  const processCSVContent = (content: string, name: string) => {
    setParseError(null);
    setImportResult(null);

    const parsedLines = parseCSV(content);
    if (parsedLines.length < 2) {
      setParseError('The uploaded CSV does not contain sufficient rows or is empty.');
      return;
    }

    const headers = parsedLines[0].map(h => normalizeHeader(h));

    // Identify column indices
    const skuIndex = headers.findIndex(h => ['sku', 'code', 'itemsku', 'productsku'].includes(h));
    const nameIndex = headers.findIndex(h => ['name', 'productname', 'title', 'itemname', 'item'].includes(h));
    const barcodeIndex = headers.findIndex(h => ['barcode', 'upc', 'ean'].includes(h));
    const catIndex = headers.findIndex(h => ['category', 'categoryid', 'cat', 'dept'].includes(h));
    const brandIndex = headers.findIndex(h => ['brand', 'vendor', 'make'].includes(h));
    const unitIndex = headers.findIndex(h => ['unit', 'uom', 'measure'].includes(h));
    const costIndex = headers.findIndex(h => ['cost', 'purchasecost', 'unitcost', 'buyprice'].includes(h));
    const priceIndex = headers.findIndex(h => ['price', 'sellingprice', 'retailprice', 'saleprice'].includes(h));
    const stockIndex = headers.findIndex(h => ['stock', 'quantity', 'stockquantity', 'qty', 'onhand'].includes(h));
    const minStockIndex = headers.findIndex(h => ['minstock', 'minstocklevel', 'safetythreshold', 'reorderpoint'].includes(h));
    const descIndex = headers.findIndex(h => ['description', 'desc', 'notes'].includes(h));

    if (skuIndex === -1 && nameIndex === -1) {
      setParseError('Could not identify a "sku" or "name" column header in the CSV file. Please check template.');
      return;
    }

    const rows: CSVInventoryRow[] = [];

    for (let r = 1; r < parsedLines.length; r++) {
      const line = parsedLines[r];
      if (line.length === 0 || (line.length === 1 && line[0] === '')) continue;

      const rawSku = skuIndex !== -1 ? line[skuIndex] : '';
      const rawName = nameIndex !== -1 ? line[nameIndex] : '';

      if (!rawSku && !rawName) continue; // Skip blank lines

      const rawCost = costIndex !== -1 ? parseFloat(line[costIndex].replace(/[^0-9.-]+/g, '')) : undefined;
      const rawPrice = priceIndex !== -1 ? parseFloat(line[priceIndex].replace(/[^0-9.-]+/g, '')) : undefined;
      const rawStock = stockIndex !== -1 ? parseInt(line[stockIndex].replace(/[^0-9.-]+/g, ''), 10) : undefined;
      const rawMinStock = minStockIndex !== -1 ? parseInt(line[minStockIndex].replace(/[^0-9.-]+/g, ''), 10) : undefined;

      // Handle category matching if category name or ID is provided
      let matchedCatId: string | undefined = undefined;
      if (catIndex !== -1 && line[catIndex]) {
        const catVal = line[catIndex].trim().toLowerCase();
        const found = categories.find(c => c.id.toLowerCase() === catVal || c.name.toLowerCase() === catVal);
        matchedCatId = found ? found.id : undefined;
      }

      rows.push({
        sku: rawSku || `SKU-${Math.floor(10000 + Math.random() * 90000)}`,
        name: rawName || `Item ${rawSku}`,
        barcode: barcodeIndex !== -1 ? line[barcodeIndex] : undefined,
        categoryId: matchedCatId,
        brand: brandIndex !== -1 ? line[brandIndex] : undefined,
        unit: unitIndex !== -1 && line[unitIndex] ? line[unitIndex] : 'piece',
        purchaseCost: !isNaN(rawCost as number) ? rawCost : undefined,
        sellingPrice: !isNaN(rawPrice as number) ? rawPrice : undefined,
        stockQuantity: !isNaN(rawStock as number) ? rawStock : undefined,
        minStockLevel: !isNaN(rawMinStock as number) ? rawMinStock : undefined,
        description: descIndex !== -1 ? line[descIndex] : undefined,
      });
    }

    if (rows.length === 0) {
      setParseError('No valid data records were found in the uploaded CSV.');
      return;
    }

    setFileName(name);
    setRawRows(rows);
    sound.playClick();
  };

  // Handle manual file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      processCSVContent(text, file.name);
    };
    reader.readAsText(file);
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a valid .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      processCSVContent(text, file.name);
    };
    reader.readAsText(file);
  };

  // Execute bulk import
  const handleExecuteImport = async () => {
    if (rawRows.length === 0) return;

    try {
      setIsProcessing(true);
      const result = await bulkImportInventoryFromCSV(rawRows, {
        stockUpdateMode,
        actorId: currentUser.id,
        actorName: currentUser.name,
        locationId: currentLocation.id,
        organizationId: 'org_nexora',
        taxRate: currentLocation.taxRate,
        defaultCategoryId: categories[0]?.id || 'cat_coffee',
      });

      sound.playSaleSuccess();
      setImportResult({
        total: result.totalProcessed,
        created: result.createdCount,
        updated: result.updatedCount,
      });
      await onSuccess();
    } catch (err: any) {
      setParseError(err.message || 'An error occurred during bulk import.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    sound.playClick();
    setFileName(null);
    setRawRows([]);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Breakdown statistics of parsed items
  const { newCount, updateCount } = useMemo(() => {
    let newItems = 0;
    let updateItems = 0;

    rawRows.forEach(r => {
      if (existingSkuMap.has(r.sku.toLowerCase().trim())) {
        updateItems++;
      } else {
        newItems++;
      }
    });

    return { newCount: newItems, updateCount: updateItems };
  }, [rawRows, existingSkuMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Bulk Inventory CSV Import</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  Dexie Ledger Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Efficiently ingest and synchronize stock levels, cost bases, selling prices, and product metadata.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-200">
          {/* Success Result View */}
          {importResult ? (
            <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Bulk Inventory Import Completed!</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                  Processed <strong className="text-white font-mono">{importResult.total}</strong> records safely into the
                  local-first ledger with immutable stock audit entries.
                </p>
              </div>

              <div className="flex justify-center gap-6 pt-2">
                <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 text-center">
                  <div className="text-xs text-slate-400">Updated Catalog SKUs</div>
                  <div className="text-xl font-bold font-mono text-sky-400 mt-0.5">{importResult.updated}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 text-center">
                  <div className="text-xs text-slate-400">New Products Added</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{importResult.created}</div>
                </div>
              </div>

              <div className="pt-3 flex justify-center gap-3">
                <button
                  onClick={resetUpload}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                >
                  Import Another File
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    onClose();
                  }}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition shadow-md shadow-sky-950"
                >
                  Done & View Inventory
                </button>
              </div>
            </div>
          ) : rawRows.length === 0 ? (
            /* Upload Stage */
            <div className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-sky-400 bg-sky-500/10'
                    : 'border-slate-700 bg-slate-950/60 hover:border-slate-500 hover:bg-slate-950/90'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="p-3.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">
                    Drop your inventory CSV file here, or{' '}
                    <span className="text-sky-400 underline underline-offset-2">browse computer</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports columns: SKU, Name, Barcode, Cost, Price, Stock, Min Stock, Category, Brand, Unit
                  </p>
                </div>
              </div>

              {parseError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Download Sample CSV Template Helper */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="text-xs text-slate-300">
                    Need the standardized format? Download our sample CSV template with pre-built headers.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold transition shrink-0 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Sample CSV
                </button>
              </div>
            </div>
          ) : (
            /* Preview and Execution Stage */
            <div className="space-y-4">
              {/* File Info Bar & Summary Cards */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white truncate max-w-xs">{fileName}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                    {rawRows.length} items parsed
                  </span>
                </div>

                <button
                  onClick={resetUpload}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Upload different file
                </button>
              </div>

              {/* Status Breakdown & Import Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Mode Option */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>Stock Update Behavior</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="radio"
                        name="stockMode"
                        checked={stockUpdateMode === 'SET_ABSOLUTE'}
                        onChange={() => setStockUpdateMode('SET_ABSOLUTE')}
                        className="text-sky-500 focus:ring-0"
                      />
                      <span>
                        <strong className="text-white">Absolute Count:</strong> Overwrite on-hand stock with CSV value
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="radio"
                        name="stockMode"
                        checked={stockUpdateMode === 'ADD_TO_EXISTING'}
                        onChange={() => setStockUpdateMode('ADD_TO_EXISTING')}
                        className="text-sky-500 focus:ring-0"
                      />
                      <span>
                        <strong className="text-white">Additive Replenishment:</strong> Add CSV quantity to current on-hand
                      </span>
                    </label>
                  </div>
                </div>

                {/* Match Summary Breakdown */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Catalog Match Breakdown</span>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Existing SKUs to Update</div>
                      <div className="text-base font-bold font-mono text-sky-400">{updateCount} items</div>
                    </div>
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">New Catalog Items</div>
                      <div className="text-base font-bold font-mono text-emerald-400">{newCount} items</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Data Preview (First 50 items)
                </div>
                <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase tracking-wider sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">SKU / Barcode</th>
                        <th className="p-2.5">Product Name</th>
                        <th className="p-2.5">Cost</th>
                        <th className="p-2.5">Price</th>
                        <th className="p-2.5">Stock Shift</th>
                        <th className="p-2.5">Min Threshold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {rawRows.slice(0, 50).map((r, idx) => {
                        const existing = existingSkuMap.get(r.sku.toLowerCase().trim());
                        const isUpdate = !!existing;

                        const currentQty = existing?.stockQuantity ?? 0;
                        const targetQty =
                          r.stockQuantity !== undefined
                            ? stockUpdateMode === 'SET_ABSOLUTE'
                              ? r.stockQuantity
                              : currentQty + r.stockQuantity
                            : currentQty;
                        const delta = targetQty - currentQty;

                        return (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2.5">
                              {isUpdate ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  UPDATE
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  NEW
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-bold text-white">
                              <div>{r.sku}</div>
                              {r.barcode && <div className="text-[10px] text-slate-500 font-normal">{r.barcode}</div>}
                            </td>
                            <td className="p-2.5 font-sans">
                              <div className="font-semibold text-white">{r.name}</div>
                              <div className="text-[10px] text-slate-400 capitalize">{r.unit || 'piece'}</div>
                            </td>
                            <td className="p-2.5 text-slate-300">
                              {r.purchaseCost !== undefined
                                ? `${currentLocation.currencySymbol}${r.purchaseCost.toFixed(2)}`
                                : isUpdate
                                ? `${currentLocation.currencySymbol}${existing.purchaseCost.toFixed(2)}`
                                : '-'}
                            </td>
                            <td className="p-2.5 text-emerald-400 font-bold">
                              {r.sellingPrice !== undefined
                                ? `${currentLocation.currencySymbol}${r.sellingPrice.toFixed(2)}`
                                : isUpdate
                                ? `${currentLocation.currencySymbol}${existing.sellingPrice.toFixed(2)}`
                                : '-'}
                            </td>
                            <td className="p-2.5">
                              {isUpdate ? (
                                <span className="flex items-center gap-1 font-semibold">
                                  <span className="text-slate-400">{currentQty}</span>
                                  <ArrowRight className="w-3 h-3 text-slate-500" />
                                  <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {targetQty} ({delta >= 0 ? `+${delta}` : delta})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold">
                                  {r.stockQuantity ?? 0}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-400">
                              {r.minStockLevel ?? (existing ? existing.minStockLevel : 5)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rawRows.length > 50 && (
                  <div className="text-[10px] text-slate-500 text-right">
                    Showing first 50 of {rawRows.length} total rows.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        {!importResult && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
              disabled={isProcessing}
            >
              Cancel
            </button>

            {rawRows.length > 0 && (
              <button
                id="execute-bulk-import-btn"
                onClick={handleExecuteImport}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition flex items-center gap-2 shadow-md shadow-sky-950 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Synchronizing Ledger...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Confirm & Commit Import ({rawRows.length} Items)</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
