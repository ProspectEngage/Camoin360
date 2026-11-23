import { Box, FormControl, MenuItem, Select, SvgIcon, Typography } from "@mui/material";

function ModuleIcon({ checked = false }) {
  return (
    <SvgIcon fontSize="small" viewBox="0 0 24 24" aria-hidden="true">
      <path d={checked
        ? "M9 16.2 4.8 12l-1.4 1.4L9 19l12-12-1.4-1.4L9 16.2Z"
        : "M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z"} />
    </SvgIcon>
  );
}

export default function DashboardModuleSelect({ options, value, onChange, collapsed = false }) {
  if (options.length < 2 || collapsed) return null;

  const selected = options.find((option) => option.value === value);

  return (
    <FormControl fullWidth size="small" sx={{ flexShrink: 0 }}>
      <Typography component="label" id="dashboard-module-label" sx={{ color: "rgba(255,255,255,0.72)", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.09em", mb: 0.75, textTransform: "uppercase" }}>
        Dashboard
      </Typography>
      <Select
        aria-labelledby="dashboard-module-label"
        displayEmpty
        inputProps={{ "aria-label": "Switch dashboard" }}
        onChange={onChange}
        renderValue={() => (
          <Box sx={{ alignItems: "center", display: "flex", gap: 1.25, minWidth: 0 }}>
            <ModuleIcon />
            <Typography component="span" sx={{ fontSize: "0.875rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected?.label || "Choose dashboard"}
            </Typography>
          </Box>
        )}
        value={value}
        MenuProps={{
          anchorOrigin: { vertical: "top", horizontal: "right" },
          transformOrigin: { vertical: "bottom", horizontal: "right" },
          PaperProps: {
            sx: {
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              boxShadow: "0 18px 40px rgba(18, 59, 100, 0.18)",
              mb: 1,
              minWidth: 220,
              p: 0.75,
            },
          },
        }}
        sx={{
          bgcolor: "rgba(255,255,255,0.10)",
          borderRadius: 1.5,
          color: "common.white",
          minHeight: 44,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.35)" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.72)" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "common.white", borderWidth: 2 },
          "& .MuiSelect-select": { py: 1.25 },
          "& .MuiSelect-icon": { color: "common.white" },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            sx={{
              borderRadius: 1,
              display: "flex",
              fontSize: "0.875rem",
              fontWeight: option.value === value ? 700 : 500,
              gap: 1.5,
              minHeight: 42,
              px: 1.5,
              "&.Mui-selected": { bgcolor: "rgba(102,138,46,0.12)", color: "primary.main" },
              "&.Mui-selected:hover": { bgcolor: "rgba(102,138,46,0.2)" },
            }}
          >
            <Box sx={{ color: option.value === value ? "secondary.main" : "text.secondary", display: "flex", width: 20 }}>
              <ModuleIcon checked={option.value === value} />
            </Box>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
