export const formatHours = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

export const formatPercent = (value) =>
  `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`;
