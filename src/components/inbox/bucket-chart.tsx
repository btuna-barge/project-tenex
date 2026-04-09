"use client";

import { useRef, useEffect, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import type { Bucket, Classification, GmailThread } from "@/types";

interface BucketChartProps {
  buckets: Bucket[];
  classifications: Map<string, Classification>;
  getThreadsByBucket: (bucketId: string) => GmailThread[];
  getUnclassifiedThreads: () => GmailThread[];
}

export function BucketChart({
  buckets,
  classifications,
  getThreadsByBucket,
  getUnclassifiedThreads,
}: BucketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HighchartsReact.RefObject>(null);
  const barRef = useRef<HighchartsReact.RefObject>(null);
  const [ready, setReady] = useState(false);

  // Wait for container to be visible and sized before rendering charts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 100) {
        setReady(true);
        // Reflow after a tick to ensure Highcharts picks up the right size
        setTimeout(() => {
          pieRef.current?.chart?.reflow();
          barRef.current?.chart?.reflow();
        }, 50);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Include every bucket (same order as sidebar) so empty buckets still appear in charts.
  const chartData = buckets.map((b) => {
    const threads = getThreadsByBucket(b.id);
    const avgConf =
      threads.length > 0
        ? threads.reduce(
            (sum, t) => sum + (classifications.get(t.id)?.confidence ?? 0),
            0
          ) / threads.length
        : 0;
    return {
      name: b.label,
      count: threads.length,
      confidence: Math.round(avgConf * 100),
      color: b.color,
    };
  });

  const unclassifiedThreads = getUnclassifiedThreads();
  if (unclassifiedThreads.length > 0) {
    const avgUnc =
      unclassifiedThreads.reduce(
        (sum, t) => sum + (classifications.get(t.id)?.confidence ?? 0),
        0
      ) / unclassifiedThreads.length;
    chartData.push({
      name: "Unclassified",
      count: unclassifiedThreads.length,
      confidence: Math.round(avgUnc * 100),
      color: "#9ca3af",
    });
  }

  // Detect dark mode for chart text color
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#e5e5e5" : "#333333";
  const tooltipBg = isDark ? "#1e1e1e" : "#ffffff";

  const pieOptions: Highcharts.Options = {
    chart: {
      type: "pie",
      backgroundColor: "transparent",
      height: 320,
      style: { fontFamily: "inherit" },
    },
    title: {
      text: "Thread Distribution",
      style: { fontSize: "15px", fontWeight: "600", color: textColor },
    },
    tooltip: {
      pointFormat: "<b>{point.y}</b> threads ({point.percentage:.0f}%)",
      style: { fontSize: "13px", color: textColor },
      backgroundColor: tooltipBg,
      borderColor: isDark ? "#444" : "#ccc",
    },
    plotOptions: {
      pie: {
        innerSize: "50%",
        borderWidth: 2,
        borderColor: undefined,
        dataLabels: {
          enabled: true,
          format: "<b>{point.name}</b>: {point.y}",
          style: { fontSize: "12px", fontWeight: "400", textOutline: "none", color: textColor },
          distance: 20,
          connectorWidth: 1,
        },
        showInLegend: true,
      },
    },
    legend: {
      layout: "horizontal",
      align: "center",
      verticalAlign: "bottom",
      itemStyle: { fontSize: "11px", fontWeight: "400", color: textColor },
    },
    series: [
      {
        type: "pie",
        name: "Threads",
        // Donut only shows buckets with threads; empty buckets appear in the bar chart below.
        data: chartData
          .filter((d) => d.count > 0)
          .map((d) => ({
            name: d.name,
            y: d.count,
            color: d.color,
          })),
      },
    ],
    credits: { enabled: false },
  };

  const sortedByConfidence = [...chartData].sort((a, b) => b.confidence - a.confidence);

  const barOptions: Highcharts.Options = {
    chart: {
      type: "bar",
      backgroundColor: "transparent",
      height: 40 + sortedByConfidence.length * 45,
      style: { fontFamily: "inherit" },
    },
    title: {
      text: "Avg Confidence by Bucket",
      style: { fontSize: "15px", fontWeight: "600", color: textColor },
    },
    xAxis: {
      categories: sortedByConfidence.map((d) => d.name),
      labels: { style: { fontSize: "12px", color: textColor } },
      lineWidth: 0,
    },
    yAxis: {
      min: 0,
      max: 100,
      title: { text: undefined },
      labels: { format: "{value}%", style: { fontSize: "11px", color: textColor } },
      gridLineColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    },
    tooltip: {
      valueSuffix: "%",
      style: { fontSize: "13px", color: textColor },
      backgroundColor: tooltipBg,
      borderColor: isDark ? "#444" : "#ccc",
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        groupPadding: 0.1,
        pointPadding: 0.05,
        dataLabels: {
          enabled: true,
          format: "{y}%",
          style: { fontSize: "12px", fontWeight: "500", textOutline: "none", color: textColor },
        },
      },
    },
    series: [
      {
        type: "bar",
        name: "Confidence",
        data: sortedByConfidence.map((d) => ({
          y: d.confidence,
          color: d.color,
        })),
        showInLegend: false,
      },
    ],
    credits: { enabled: false },
    legend: { enabled: false },
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {ready ? (
        <>
          <HighchartsReact highcharts={Highcharts} options={pieOptions} ref={pieRef} />
          <HighchartsReact highcharts={Highcharts} options={barOptions} ref={barRef} />
        </>
      ) : (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
          <span className="text-sm">Loading charts...</span>
        </div>
      )}
    </div>
  );
}
