import DashboardShell from "./components/DashboardShell";
import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";

import {
  MODULE_OPTIONS,
  createAppUser,
  deleteAppUser,
  getApiErrorMessage,
  listAppUsers,
  updateAppUser,
} from "./auth";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  modules: ["main"],
};



function normalizeModules(modules) {
  return MODULE_OPTIONS.filter((option) => modules.includes(option.value)).map((option) => option.value);
}

function ModuleCheckboxes({ disabledModules = [], onChange, value }) {
  const selectedModules = new Set(value);

  function toggleModule(moduleValue) {
    const nextModules = new Set(selectedModules);

    if (nextModules.has(moduleValue)) {
      nextModules.delete(moduleValue);
    } else {
      nextModules.add(moduleValue);
    }

    onChange(normalizeModules([...nextModules]));
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 0.5,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      {MODULE_OPTIONS.map((moduleOption) => (
        <FormControlLabel
          control={
            <Checkbox
              checked={selectedModules.has(moduleOption.value)}
              disabled={disabledModules.includes(moduleOption.value)}
              onChange={() => toggleModule(moduleOption.value)}
            />
          }
          key={moduleOption.value}
          label={moduleOption.label}
          sx={{ m: 0 }}
        />
      ))}
    </Box>
  );
}

export default function AdminDashboard({ onLogout, moduleSwitcher }) {
  const [users, setUsers] = useState([]);
  const [formValues, setFormValues] = useState(emptyForm);
  const [draftModulesByEmail, setDraftModulesByEmail] = useState({});
  const [draftPasswordByEmail, setDraftPasswordByEmail] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const createPassword = formValues.password || "";
  const createConfirmPassword = formValues.confirmPassword || "";
  const createPasswordMismatch =
    createConfirmPassword.length > 0 && createPassword !== createConfirmPassword;

  const sortedUsers = useMemo(
    () =>
      [...users].sort((firstUser, secondUser) => {
        if (firstUser.role === "admin") return -1;
        if (secondUser.role === "admin") return 1;
        return firstUser.email.localeCompare(secondUser.email);
      }),
    [users]
  );

  async function loadUsers() {
    setError("");
    setIsLoading(true);

    try {
      const loadedUsers = await listAppUsers();
      setUsers(loadedUsers);
      setDraftModulesByEmail(
        Object.fromEntries(loadedUsers.map((user) => [user.email, normalizeModules(user.modules || [])]))
      );
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Unable to load users."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function updateFormValue(field, value) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  async function handleCreateUser(event) {
    event.preventDefault();

    if (createPassword !== createConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setSuccess("");
    setIsCreating(true);

    try {
      const createdUser = await createAppUser({
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        password: createPassword,
        modules: formValues.modules,
      });
      setUsers((currentUsers) => [...currentUsers, createdUser]);
      setDraftModulesByEmail((currentModules) => ({
        ...currentModules,
        [createdUser.email]: createdUser.modules,
      }));
      setFormValues(emptyForm);
      setSuccess(`Created ${createdUser.email}.`);
    } catch (createError) {
      setError(getApiErrorMessage(createError, "Unable to create user."));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveUser(user) {
    setError("");
    setSuccess("");

    try {
      const payload = {
        modules: draftModulesByEmail[user.email] || [],
      };

      if (draftPasswordByEmail[user.email]) {
        payload.password = draftPasswordByEmail[user.email];
      }

      const updatedUser = await updateAppUser(user.email, payload);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) => (currentUser.email === updatedUser.email ? updatedUser : currentUser))
      );
      setDraftModulesByEmail((currentModules) => ({
        ...currentModules,
        [updatedUser.email]: updatedUser.modules,
      }));
      setDraftPasswordByEmail((currentPasswords) => ({
        ...currentPasswords,
        [updatedUser.email]: "",
      }));
      setSuccess(`Updated ${updatedUser.email}.`);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Unable to update user."));
    }
  }

  async function handleDeleteUser(user) {
    setError("");
    setSuccess("");

    try {
      await deleteAppUser(user.email);
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.email !== user.email));
      setSuccess(`Deleted ${user.email}.`);
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, "Unable to delete user."));
    }
  }

  return (
    <DashboardShell module="admin" label="User Admin" views={{ users: { label: "Users", title: "User Admin", description: "Create Camoin 360 users and assign the modules they can open." } }} activeView={"users"} onNavigate={() => {}} onLogout={onLogout} moduleSwitcher={moduleSwitcher}>
      <Stack spacing={3}>


              {error ? <Alert severity="error">{error}</Alert> : null}
              {success ? <Alert severity="success">{success}</Alert> : null}

              <Paper
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: { xs: 2, md: 3 },
                }}
              >
                <Stack component="form" spacing={2.25} onSubmit={handleCreateUser}>
                  <Typography color="primary.main" sx={{ fontWeight: 800 }} variant="h6">
                    Create User
                  </Typography>
                  <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
                    <TextField
                      autoComplete="name"
                      fullWidth
                      label="Full name"
                      onChange={(event) => updateFormValue("name", event.target.value)}
                      required
                      value={formValues.name}
                    />
                    <TextField
                      autoComplete="email"
                      fullWidth
                      label="Email"
                      onChange={(event) => updateFormValue("email", event.target.value)}
                      required
                      type="email"
                      value={formValues.email}
                    />
                    <TextField
                      autoComplete="new-password"
                      fullWidth
                      inputProps={{ minLength: 8 }}
                      label="Password"
                      onChange={(event) => updateFormValue("password", event.target.value)}
                      required
                      type="password"
                      value={createPassword}
                    />
                    <TextField
                      autoComplete="new-password"
                      error={createPasswordMismatch}
                      fullWidth
                      helperText={createPasswordMismatch ? "Passwords do not match." : " "}
                      inputProps={{ minLength: 8 }}
                      label="Confirm password"
                      onChange={(event) => updateFormValue("confirmPassword", event.target.value)}
                      required
                      type="password"
                      value={createConfirmPassword}
                    />
                  </Box>
                  <ModuleCheckboxes
                    onChange={(modules) => updateFormValue("modules", modules)}
                    value={formValues.modules}
                  />
                  <Box>
                    <Button disabled={createPasswordMismatch || isCreating} type="submit" variant="contained">
                      {isCreating ? "Creating..." : "Create user"}
                    </Button>
                  </Box>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    alignItems: "center",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    gap: 2,
                    justifyContent: "space-between",
                    px: { xs: 2, md: 3 },
                    py: 2,
                  }}
                >
                  <Typography color="primary.main" sx={{ fontWeight: 800 }} variant="h6">
                    Existing Users
                  </Typography>
                  <Button disabled={isLoading} onClick={loadUsers} variant="outlined">
                    Refresh
                  </Button>
                </Box>

                <Box sx={{ overflowX: "auto" }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell sx={{ minWidth: 360 }}>Module Access</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>Reset Password</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedUsers.map((user) => {
                        const isAdmin = user.role === "admin";

                        return (
                          <TableRow key={user.email}>
                            <TableCell>
                              <Typography sx={{ fontWeight: 800 }}>{user.name}</Typography>
                              <Typography color="text.secondary" variant="body2">
                                {user.email}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textTransform: "capitalize" }}>{user.role}</TableCell>
                            <TableCell>
                              <ModuleCheckboxes
                                disabledModules={isAdmin ? MODULE_OPTIONS.map((option) => option.value) : []}
                                onChange={(modules) =>
                                  setDraftModulesByEmail((currentModules) => ({
                                    ...currentModules,
                                    [user.email]: modules,
                                  }))
                                }
                                value={draftModulesByEmail[user.email] || user.modules || []}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                autoComplete="new-password"
                                disabled={isAdmin}
                                fullWidth
                                inputProps={{ minLength: 8 }}
                                label="New password"
                                onChange={(event) =>
                                  setDraftPasswordByEmail((currentPasswords) => ({
                                    ...currentPasswords,
                                    [user.email]: event.target.value,
                                  }))
                                }
                                size="small"
                                type="password"
                                value={draftPasswordByEmail[user.email] || ""}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                <Button disabled={isAdmin} onClick={() => handleSaveUser(user)} variant="contained">
                                  Save
                                </Button>
                                <Button color="error" disabled={isAdmin} onClick={() => handleDeleteUser(user)} variant="outlined">
                                  Delete
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Paper>
            </Stack>
    </DashboardShell>
  );
}
