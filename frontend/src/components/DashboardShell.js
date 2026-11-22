import { useState } from "react";
import { Box, Button, Container, Divider, IconButton, Stack, SvgIcon, Tooltip, Typography, useTheme, useMediaQuery } from "@mui/material";
import { SidebarResizeHandle, useResizableSidebar } from "../useResizableSidebar";
const iconPaths = {
  campaign:
    "M4 10v4h3l5 4V6l-5 4H4Zm10.5 4.8 1.4 1.4A6 6 0 0 0 18 12a6 6 0 0 0-2.1-4.2l-1.4 1.4A4 4 0 0 1 16 12a4 4 0 0 1-1.5 2.8Z",
  collapse:
    "M15.5 5 8.5 12l7 7-1.4 1.4L5.7 12l8.4-8.4L15.5 5Zm4 0-7 7 7 7-1.4 1.4L9.7 12l8.4-8.4L19.5 5Z",
  expand:
    "m8.5 5 7 7-7 7 1.4 1.4 8.4-8.4-8.4-8.4L8.5 5Zm-4 0 7 7-7 7 1.4 1.4 8.4-8.4-8.4-8.4L4.5 5Z",
  finance: "M5 19V9h3v10H5Zm5 0V5h3v14h-3Zm5 0v-7h3v7h-3Z",
  chevronDown: "m7 10 5 5 5-5-1.4-1.4L12 12.2 8.4 8.6 7 10Z",
  chevronRight: "m10 7 5 5-5 5-1.4-1.4 3.6-3.6-3.6-3.6L10 7Z",
  overview: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  menu: "M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z",
  close: "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z",
  projects: "M5 5h14v4H5V5Zm0 6h9v4H5v-4Zm0 6h14v2H5v-2Zm11-6h3v4h-3v-4Z",
  signout: "M10 17v-2h4V9h-4V7h6v10h-6Zm-1-1-5-4 5-4v3h6v2H9v3Z",
  trending:
    "M4 17h16v2H4v-2Zm1-3 5-5 4 4 5-7 1.6 1.2-6.4 8.9-4.1-4.1-3.7 3.7L5 14Z",
};

function NavIcon({ name }) {
  return (
    <SvgIcon fontSize="small" viewBox="0 0 24 24">
      <path d={iconPaths[name]} />
    </SvgIcon>
  );
}

export default function DashboardShell({ module, label, views, activeView, onNavigate, onPrefetch, onLogout, children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sidebarResize = useResizableSidebar(module);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const collapsed = isDesktop && sidebarCollapsed;
  const currentView = views[activeView];
  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `radial-gradient(circle at top left, ${theme.palette.secondary.main}12, transparent 30%), ${theme.palette.background.default}`,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: collapsed ? "88px minmax(0, 1fr)" : `${sidebarResize.width}px minmax(0, 1fr)`,
          },
          minHeight: "100vh",
          transition: sidebarResize.isResizing ? "none" : "grid-template-columns 180ms ease",
        }}
      >
        <Box
          component="aside"
          sx={{
            alignSelf: { md: "start" },
            backgroundColor: "primary.main",
            color: "common.white",
            height: { md: "100vh" },
            overflow: { md: "hidden" },
            p: { xs: 1.5, md: 3 },
            position: { xs: "relative", md: "sticky" },
            top: { md: 0 },
            transition: "padding 180ms ease",
          }}
        >
          {!collapsed && (
            <SidebarResizeHandle
              isResizing={sidebarResize.isResizing}
              onReset={sidebarResize.resetWidth}
              onResizeStart={sidebarResize.startResize}
            />
          )}
          <Stack
            spacing={{ xs: 1.5, md: 3 }}
            sx={{
              height: { md: "100%" },
              minHeight: 0,
            }}
          >
            <Box
              sx={{
                alignItems: "flex-start",
                display: "flex",
                gap: 2,
                justifyContent: collapsed ? "center" : "space-between",
              }}
            >
              {!collapsed && (
                <Box>
                  <Typography
                    component="h1"
                    sx={{
                      fontSize: "1.55rem",
                      fontWeight: 800,
                      lineHeight: 1.1,
                    }}
                  >
                    Camoin 360
                  </Typography>
                  <Typography
                    sx={{ color: "rgba(255,255,255,0.72)", mt: 0.75 }}
                    variant="body2"
                  >
                    <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>{label}</Box>
                    <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>{currentView.label}</Box>
                  </Typography>
                </Box>
              )}

              <IconButton
                aria-label={
                  collapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                size="small"
                sx={{
                  borderColor: "rgba(255,255,255,0.32)",
                  borderStyle: "solid",
                  borderWidth: 1,
                  color: "common.white",
                  height: 36,
                  width: 36,
                  display: { xs: "none", md: "inline-flex" },
                  "&:hover": {
                    borderColor: "common.white",
                    backgroundColor: "rgba(255,255,255,0.10)",
                  },
                }}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <NavIcon name={collapsed ? "expand" : "collapse"} />
              </IconButton>
              <IconButton
                aria-controls={`${module}-navigation`}
                aria-expanded={mobileNavOpen}
                aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
                onClick={() => setMobileNavOpen((open) => !open)}
                sx={{ color: "common.white", display: { xs: "inline-flex", md: "none" }, height: 44, width: 44 }}
              >
                <NavIcon name={mobileNavOpen ? "close" : "menu"} />
              </IconButton>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.18)" }} />

            <Stack
              component="nav"
              id={`${module}-navigation`}
              aria-label={`${label} navigation`}
              spacing={1}
              sx={{
                display: { xs: mobileNavOpen ? "flex" : "none", md: "flex" },
                flex: { md: 1 },
                minHeight: 0,
                overflowX: "hidden",
                overflowY: "auto",
                maxHeight: { xs: "min(60vh, 440px)", md: "none" },
                pb: { xs: 0.5, md: 0 },
              }}
            >
              {Object.entries(views).map(([key, view]) => (
                <Tooltip key={key} title={view.label} placement="right" disableHoverListener={!collapsed}>
                  <Button component={view.route ? "a" : "button"} href={view.route}
                    aria-label={view.label} aria-current={activeView === key ? "page" : undefined}
                    onMouseEnter={() => onPrefetch?.(key)} onFocus={() => onPrefetch?.(key)}
                    onClick={(event) => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault(); onNavigate(key); setMobileNavOpen(false);
                    }}
                    startIcon={<NavIcon name={iconPaths[view.icon] ? view.icon : "overview"} />}
                    sx={{ justifyContent: collapsed ? "center" : "flex-start", borderRadius: 1,
                      color: activeView === key ? "primary.main" : "common.white",
                      backgroundColor: activeView === key ? "common.white" : "transparent",
                      fontWeight: 800, minWidth: 0, textAlign: "left", px: collapsed ? 1 : 2,
                      "& .MuiButton-startIcon": { m: collapsed ? 0 : undefined },
                      "&:hover": { backgroundColor: activeView === key ? "common.white" : "rgba(255,255,255,0.12)" } }}>
                    {!collapsed && view.label}
                  </Button>
                </Tooltip>
              ))}
            </Stack>

            <Button
              fullWidth
              aria-label="Sign out"
              onClick={onLogout}
              startIcon={<NavIcon name="signout" />}
              sx={{
                borderColor: "rgba(255,255,255,0.42)",
                color: "common.white",
                borderRadius: 1,
                fontWeight: 800,
                justifyContent: collapsed ? "center" : "flex-start",
                minWidth: 0,
                px: collapsed ? 1 : 2,
                alignSelf: { xs: "flex-start", md: "stretch" },
                fontSize: "0.875rem",
                position: { xs: "static", md: "static" },
                width: { xs: mobileNavOpen ? "100%" : 44, md: "100%" },
                display: { xs: mobileNavOpen ? "inline-flex" : "none", md: "inline-flex" },
                "& .MuiButton-startIcon": {
                  m: { xs: 0, md: collapsed ? 0 : undefined },
                },
                "&:hover": {
                  borderColor: "common.white",
                  backgroundColor: "rgba(255,255,255,0.10)",
                },
              }}
              title="Sign out"
              variant="outlined"
            >
              {!collapsed && "Sign out"}
            </Button>
          </Stack>
        </Box>

        <Box component="main" sx={{ minWidth: 0, py: { xs: 2, md: 5 } }}>
          <Container maxWidth={false} sx={{ maxWidth: 1600, minWidth: 0, px: { xs: 2, sm: 3 }, width: "100%" }}>
            <Box sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 3, mb: 3, position: "relative",
              "&::after": { content: '\'""\'', position: "absolute", bottom: -1, left: 0, width: 48, height: 3, bgcolor: "secondary.main" } }}>
              <Typography sx={{ color: "secondary.dark", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.11em", mb: 0.75, textTransform: "uppercase" }}>{label}</Typography>
              <Typography component="h2" sx={{ color: "primary.main", fontSize: { xs: "2rem", md: "2.35rem" }, fontWeight: 750, letterSpacing: "-0.035em", lineHeight: 1.1, mb: 1 }}>
                {currentView.title || currentView.label}
              </Typography>
              <Typography sx={{ color: "text.secondary", fontSize: { xs: "1rem", md: "1.08rem" }, maxWidth: 760 }}>{currentView.description}</Typography>
            </Box>
            {children}
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
