import monthlyGuideData from "../data/monthlyGuide.json";

export type MonthlyGuideEntry = {
  month: number;
  title: string;
  intro: string;
  sections: {
    heading: string;
    items: string[];
  }[];
  focus: string;
};

const monthlyGuide = monthlyGuideData as MonthlyGuideEntry[];

export function getMonthlyGuide(month: number): MonthlyGuideEntry | undefined {
  return monthlyGuide.find((entry) => entry.month === month);
}