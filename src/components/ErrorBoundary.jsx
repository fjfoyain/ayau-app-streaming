import { Component } from "react";
import { Box, Typography, Button } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 2,
            px: 3,
            textAlign: "center",
            bgcolor: "background.default",
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 56, color: "warning.main" }} />
          <Typography variant="h5" fontWeight={600}>
            Algo salió mal
          </Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={400}>
            Ocurrió un error inesperado. Por favor recarga la página. Si el
            problema persiste, contacta al administrador.
          </Typography>
          <Button variant="contained" onClick={this.handleReload}>
            Recargar página
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
