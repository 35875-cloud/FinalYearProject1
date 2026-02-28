import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import CitizenLayout, { PageHero, StatusPill, T, fmt, fmtDateTime } from "./CitizenLayout";

const ListingModal = ({ property, saving, onClose, onSubmit }) => {
  const [askingPrice, setAskingPrice] = useState(property?.asking_price || "");

  useEffect(() => {
    setAskingPrice(property?.asking_price || "");
  }, [property]);

  if (!property) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.55)",
      backdropFilter: "blur(5px)",
      zIndex: 5000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 520,
        background: "#fff",
        borderRadius: 24,
        overflow: "hidden",
        border: `1px solid ${T.border}`,
        boxShadow: "0 28px 60px rgba(15,23,42,.24)",
      }}>
        <div style={{
          padding: "1.35rem 1.5rem",
          background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`,
          color: "#fff",
        }}>
          <div style={{ fontSize: ".72rem", fontWeight: 700, opacity: 0.75, textTransform: "uppercase", letterSpacing: ".08em" }}>
            Seller Listing
          </div>
          <div style={{ fontSize: "1.15rem", fontWeight: 800, marginTop: 4 }}>
            {property.is_for_sale ? "Update Marketplace Price" : "List Property for Sale"}
          </div>
          <div style={{ fontSize: ".82rem", opacity: 0.78, marginTop: 6 }}>
            {[property.district, property.tehsil, property.mauza].filter(Boolean).join(", ") || property.property_id}
          </div>
        </div>

        <div style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: ".78rem", fontWeight: 700, color: T.text, marginBottom: 8 }}>
              Asking Price (PKR)
            </div>
            <input
              type="number"
              min="0"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              placeholder="e.g. 5000000"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: `1.5px solid ${T.border}`,
                fontSize: ".92rem",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{
            background: "#f8fafc",
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: "12px 14px",
            marginBottom: 20,
            fontSize: ".82rem",
            color: T.text2,
            lineHeight: 1.6,
          }}>
            Buyer pehle interest request bhejega. Seller accept karega to negotiation room ready ho jayega,
            jahan receipt, agreement, challan, aur payment flow continue hoga.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: `1.5px solid ${T.border}`,
                background: "#fff",
                color: T.text2,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(property.property_id, askingPrice)}
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "none",
                background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`,
                color: "#fff",
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                opacity: saving ? 0.65 : 1,
              }}
            >
              <i className={`fas ${saving ? "fa-spinner fa-spin" : "fa-store"}`} />
              {saving ? "Saving..." : property.is_for_sale ? "Update Listing" : "List on Marketplace"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RequestCard = ({ request, busyKey, onAccept, onReject }) => {
  const location = [request.district, request.tehsil, request.mauza].filter(Boolean).join(", ");
  const active = busyKey === request.request_id;

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${T.border}`,
      borderRadius: 18,
      padding: "1.1rem 1.25rem",
      boxShadow: "0 4px 16px rgba(13,124,124,.07)",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: ".78rem", color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
            Buyer Request
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 800, color: T.text, marginTop: 4 }}>
            {request.buyer_name || "Unknown Buyer"}
          </div>
          <div style={{ fontSize: ".88rem", color: T.text2, marginTop: 4 }}>
            {location || request.property_id}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <StatusPill status={request.status} />
          <span style={{
            background: T.primaryLight,
            color: T.primary,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: ".78rem",
            fontWeight: 700,
          }}>
            PKR {fmt(request.asking_price || 0)}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {[
          { label: "Property ID", value: request.property_id },
          { label: "Buyer CNIC", value: request.buyer_cnic || "—" },
          { label: "Buyer Email", value: request.buyer_email || "—" },
          { label: "Requested", value: fmtDateTime(request.created_at) },
        ].map((item) => (
          <div key={item.label} style={{
            background: T.surface2,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "10px 12px",
          }}>
            <div style={{ fontSize: ".72rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>
              {item.label}
            </div>
            <div style={{ fontSize: ".88rem", fontWeight: 700, color: T.text, marginTop: 5, wordBreak: "break-word" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {request.buyer_message && (
        <div style={{
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: 12,
          padding: "12px 14px",
        }}>
          <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>
            Buyer Message
          </div>
          <div style={{ fontSize: ".9rem", color: "#78350F", lineHeight: 1.6 }}>
            {request.buyer_message}
          </div>
        </div>
      )}

      {request.status === "PENDING" ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => onAccept(request)}
            disabled={active}
            style={{
              flex: 1,
              minWidth: 160,
              padding: "11px 16px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#047857,#10B981)",
              color: "#fff",
              fontWeight: 800,
              fontSize: ".9rem",
              cursor: active ? "not-allowed" : "pointer",
              opacity: active ? 0.65 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            <i className={`fas ${active ? "fa-spinner fa-spin" : "fa-check-circle"}`} />
            Accept & Negotiate
          </button>
          <button
            onClick={() => onReject(request)}
            disabled={active}
            style={{
              flex: 1,
              minWidth: 130,
              padding: "11px 16px",
              borderRadius: 10,
              border: "1.5px solid #FECACA",
              background: "#FEF2F2",
              color: "#DC2626",
              fontWeight: 800,
              fontSize: ".9rem",
              cursor: active ? "not-allowed" : "pointer",
              opacity: active ? 0.65 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            <i className="fas fa-times-circle" />
            Reject
          </button>
        </div>
      ) : request.status === "ACCEPTED" ? (
        <div style={{
          background: T.primaryLight,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "11px 14px",
          color: T.primary,
          fontSize: ".9rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <i className="fas fa-check-circle" />
          Negotiation room created — continue from Transfer Inbox.
        </div>
      ) : (
        <div style={{
          background: T.surface2,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "11px 14px",
          color: T.text2,
          fontSize: ".9rem",
          fontWeight: 600,
        }}>
          This request has already been handled.
        </div>
      )}
    </div>
  );
};

const ListingRow = ({ index, listing, onList, onUnlist }) => {
  return (
    <div style={{
      background: "#fff",
      borderBottom: `1px solid ${T.border}`,
      padding: "1rem 1.5rem",
      display: "grid",
      gridTemplateColumns: "60px minmax(0, 1.5fr) minmax(160px, .7fr) minmax(220px, .9fr)",
      gap: 12,
      alignItems: "center",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 10,
        background: T.primaryLight,
        color: T.primary,
        fontWeight: 800,
        fontSize: ".9rem",
      }}>
        {index + 1}
      </div>

      <div>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: T.text }}>
          {listing.property_id}
        </div>
        <div style={{ fontSize: ".88rem", color: T.text2, marginTop: 4 }}>
          {[listing.district, listing.tehsil, listing.mauza].filter(Boolean).join(", ") || "Property details pending"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ fontSize: ".8rem", color: T.muted, fontWeight: 600 }}>
            {listing.area_marla ? `${listing.area_marla} Marla` : "Area not set"}
          </span>
          {listing.khasra_no && (
            <span style={{ fontSize: ".8rem", color: T.muted, fontWeight: 600 }}>
              · Khasra {listing.khasra_no}
            </span>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: ".75rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
          Listing Status
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusPill status={listing.is_for_sale ? "ACTIVE" : "INACTIVE"} />
          {listing.pending_requests > 0 && (
            <span style={{
              background: "#FFFBEB",
              color: "#D97706",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: ".78rem",
              fontWeight: 700,
            }}>
              {listing.pending_requests} Requests
            </span>
          )}
        </div>
        <div style={{ fontSize: ".85rem", color: T.text2, marginTop: 8 }}>
          {listing.is_for_sale
            ? `PKR ${fmt(listing.asking_price || 0)}`
            : "Not visible on marketplace"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          onClick={() => onList(listing)}
          style={{
            padding: "9px 16px",
            borderRadius: 10,
            border: "none",
            background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`,
            color: "#fff",
            fontWeight: 700,
            fontSize: ".88rem",
            cursor: "pointer",
            minWidth: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <i className={`fas ${listing.is_for_sale ? "fa-pen" : "fa-store"}`} />
          {listing.is_for_sale ? "Update Price" : "List on Market"}
        </button>
        {listing.is_for_sale && (
          <button
            onClick={() => onUnlist(listing)}
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              border: `1.5px solid ${T.border}`,
              background: "#fff",
              color: T.text2,
              fontWeight: 700,
              fontSize: ".88rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="fas fa-eye-slash" />
            Unlist
          </button>
        )}
      </div>
    </div>
  );
};

const SellerPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authToken = sessionStorage.getItem("authToken");
  const BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000/api/auth").replace("/api/auth", "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRequest, setBusyRequest] = useState(null);
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [modalProperty, setModalProperty] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("listings");
  const requestsSectionRef = useRef(null);

  const highlightedPropertyId = searchParams.get("propertyId");

  useEffect(() => {
    if (!authToken) {
      navigate("/login");
      return;
    }
    loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!highlightedPropertyId || listings.length === 0 || modalProperty) return;
    const found = listings.find((item) => item.property_id === highlightedPropertyId);
    if (found) setModalProperty(found);
  }, [highlightedPropertyId, listings, modalProperty]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadWorkspace();
    }, 30000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [listingsRes, requestsRes, ownedRes] = await Promise.all([
        fetch(`${BASE}/api/marketplace/seller/listings`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${BASE}/api/marketplace/seller/requests`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${BASE}/api/properties/my-properties`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      const listingsData = await listingsRes.json().catch(() => ({}));
      const requestsData = await requestsRes.json().catch(() => ({}));
      const ownedData = await ownedRes.json().catch(() => ({}));

      if (!requestsRes.ok || requestsData.success === false) {
        throw new Error(requestsData.message || "Unable to load buyer requests");
      }

      const listingMap = new Map();

      if (listingsRes.ok && listingsData.success !== false) {
        for (const item of (listingsData.listings || [])) {
          listingMap.set(item.property_id, item);
        }
      }

      if (ownedRes.ok && ownedData.success !== false) {
        for (const item of (ownedData.properties || [])) {
          if (!listingMap.has(item.property_id)) {
            listingMap.set(item.property_id, {
              property_id: item.property_id,
              owner_id: item.owner_id,
              owner_name: item.owner_name,
              property_type: item.property_type,
              district: item.district,
              tehsil: item.tehsil,
              mauza: item.mauza,
              area_marla: item.area_marla,
              khasra_no: item.khasra_no,
              fard_no: item.fard_no,
              is_for_sale: Boolean(item.is_for_sale),
              asking_price: item.asking_price || null,
              listed_at: item.listed_at || item.created_at,
              pending_requests: 0,
              accepted_requests: 0,
              rejected_requests: 0,
            });
          }
        }
      }

      const mergedListings = Array.from(listingMap.values()).sort((a, b) => {
        const aDate = new Date(a.listed_at || 0).getTime();
        const bDate = new Date(b.listed_at || 0).getTime();
        return bDate - aDate;
      });

      setListings(mergedListings);
      setRequests(requestsData.requests || []);
    } catch (error) {
      showToast(error.message || "Seller workspace load failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleListingSubmit = async (propertyId, askingPrice) => {
    setSaving(true);
    try {
      const response = await fetch(`${BASE}/api/marketplace/listings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId,
          action: "LIST",
          askingPrice,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Could not list property");
      }

      setModalProperty(null);
      showToast("Property is now live on the marketplace.");
      await loadWorkspace();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlist = async (listing) => {
    setSaving(true);
    try {
      const response = await fetch(`${BASE}/api/marketplace/listings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: listing.property_id,
          action: "UNLIST",
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Could not unlist property");
      }

      showToast("Property removed from marketplace.");
      await loadWorkspace();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (request) => {
    setBusyRequest(request.request_id);
    try {
      const response = await fetch(`${BASE}/api/marketplace/request/${request.request_id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Could not accept request");
      }

      showToast("Buyer request accepted. Start the chat from My Transfers.");
      await loadWorkspace();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusyRequest(null);
    }
  };

  const handleReject = async (request) => {
    setBusyRequest(request.request_id);
    try {
      const response = await fetch(`${BASE}/api/marketplace/request/${request.request_id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note: "Seller declined this marketplace request." }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Could not reject request");
      }

      showToast("Buyer request rejected.");
      await loadWorkspace();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusyRequest(null);
    }
  };

  const stats = useMemo(() => {
    const listed = listings.filter((item) => item.is_for_sale).length;
    const pending = requests.filter((item) => item.status === "PENDING").length;
    const accepted = requests.filter((item) => item.status === "ACCEPTED").length;
    const readyChat = requests.filter((item) => item.status === "ACCEPTED" && item.transfer_id).length;
    return { listed, pending, accepted, readyChat };
  }, [listings, requests]);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  const tabBtnStyle = (tab) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    border: "none",
    borderRadius: 10,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
    fontSize: ".9rem",
    cursor: "pointer",
    transition: "all .18s",
    background: activeTab === tab ? T.primary : "transparent",
    color: activeTab === tab ? "#fff" : T.text2,
    boxShadow: activeTab === tab ? "0 4px 14px rgba(13,124,124,.25)" : "none",
  });

  return (
    <CitizenLayout title="Seller Portal">
      {toast && (
        <div style={{
          position: "fixed",
          top: 84,
          right: 22,
          zIndex: 7000,
          background: toast.type === "error" ? "#FEF2F2" : "#ECFDF5",
          color: toast.type === "error" ? "#DC2626" : "#047857",
          border: `1px solid ${toast.type === "error" ? "#FECACA" : "#A7F3D0"}`,
          borderRadius: 14,
          padding: "12px 16px",
          fontSize: ".9rem",
          fontWeight: 700,
          boxShadow: "0 12px 28px rgba(15,23,42,.14)",
          maxWidth: 360,
        }}>
          {toast.msg}
        </div>
      )}

      <ListingModal
        property={modalProperty}
        saving={saving}
        onClose={() => setModalProperty(null)}
        onSubmit={handleListingSubmit}
      />

      <PageHero
        icon="fas fa-hand-holding-usd"
        title="Seller Portal"
        subtitle="Apni approved properties yahan list karein, buyer requests review karein, aur accepted request ko negotiation chat tak bhejein."
        stats={[
          { label: "Listed", value: stats.listed, icon: "fas fa-store", bg: "#ffffff", border: "#C8E0E0", iconBg: "#E6F4F2", iconColor: "#0D7C7C" },
          { label: "Pending Requests", value: stats.pending, icon: "fas fa-inbox", bg: "#ffffff", border: "#FDE68A", iconBg: "#FFFBEB", iconColor: "#D97706" },
          { label: "Accepted", value: stats.accepted, icon: "fas fa-check-circle", bg: "#ffffff", border: "#BBF7D0", iconBg: "#ECFDF5", iconColor: "#059669" },
          { label: "Ready for Chat", value: stats.readyChat, icon: "fas fa-comments", bg: "#ffffff", border: "#C8E0E0", iconBg: "#E6F4F2", iconColor: "#0D7C7C" },
        ]}
      />

      {/* ── TAB STRIP ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "#fff",
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: "6px",
        marginBottom: 18,
        boxShadow: "0 2px 10px rgba(13,124,124,.06)",
      }}>
        <button style={tabBtnStyle("listings")} onClick={() => setActiveTab("listings")}>
          <i className="fas fa-store" />
          My Listings
          <span style={{
            background: activeTab === "listings" ? "rgba(255,255,255,.25)" : T.primaryLight,
            color: activeTab === "listings" ? "#fff" : T.primary,
            borderRadius: 999,
            fontSize: ".75rem",
            fontWeight: 800,
            padding: "1px 8px",
            minWidth: 22,
            textAlign: "center",
          }}>{listings.length}</span>
        </button>

        <button style={tabBtnStyle("requests")} onClick={() => setActiveTab("requests")}>
          <i className="fas fa-inbox" />
          Buyer Requests
          {pendingCount > 0 && (
            <span style={{
              background: activeTab === "requests" ? "rgba(255,255,255,.25)" : "#FFFBEB",
              color: activeTab === "requests" ? "#fff" : "#D97706",
              border: activeTab === "requests" ? "none" : "1px solid #FDE68A",
              borderRadius: 999,
              fontSize: ".75rem",
              fontWeight: 800,
              padding: "1px 8px",
              minWidth: 22,
              textAlign: "center",
            }}>{pendingCount} pending</span>
          )}
        </button>
      </div>

      {/* ── LISTINGS PANEL ── */}
      {activeTab === "listings" && (
        <section style={{
          background: "#fff",
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(13,124,124,.07)",
        }}>
          {/* Section header */}
          <div style={{
            padding: "1.25rem 1.5rem",
            borderBottom: `1px solid ${T.border}`,
            background: "#FAFEFE",
          }}>
            <div style={{ fontSize: ".78rem", color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>
              Seller Listings
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: T.text, marginTop: 4 }}>
              Select Property for Sale
            </div>
            <div style={{ fontSize: ".9rem", color: T.text2, marginTop: 4, lineHeight: 1.5 }}>
              Yahan se property choose karke price set karein. Buyer marketplace se request bhejega.
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center", color: T.text2 }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: "1.5rem", color: T.primary }} />
              <div style={{ marginTop: 12, fontWeight: 700, fontSize: ".95rem" }}>Loading seller properties...</div>
            </div>
          ) : listings.length === 0 ? (
            <div style={{
              margin: "1.5rem",
              padding: "2.5rem 1.25rem",
              borderRadius: 14,
              border: `1.5px dashed ${T.border}`,
              textAlign: "center",
              color: T.text2,
              fontSize: ".95rem",
            }}>
              No approved direct-owned properties are available for sale.
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "60px minmax(0, 1.5fr) minmax(160px, .7fr) minmax(220px, .9fr)",
                gap: 12,
                alignItems: "center",
                padding: "0.75rem 1.5rem",
                background: "#F5FAFA",
                borderBottom: `1px solid ${T.border}`,
                fontSize: ".78rem",
                fontWeight: 800,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: ".08em",
              }}>
                <div>#</div>
                <div>Property</div>
                <div>Sale Status</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {listings.map((listing, index) => (
                <ListingRow
                  key={listing.property_id}
                  index={index}
                  listing={listing}
                  onList={setModalProperty}
                  onUnlist={handleUnlist}
                />
              ))}
            </>
          )}
        </section>
      )}

      {/* ── REQUESTS PANEL ── */}
      {activeTab === "requests" && (
        <section ref={requestsSectionRef} style={{
          background: "#fff",
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(13,124,124,.07)",
        }}>
          {/* Section header */}
          <div style={{
            padding: "1.25rem 1.5rem",
            borderBottom: `1px solid ${T.border}`,
            background: "#FAFEFE",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: ".78rem", color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>
                Incoming Property Requests
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: T.text, marginTop: 4 }}>
                Buyer Interest Inbox
              </div>
              <div style={{ fontSize: ".9rem", color: T.text2, marginTop: 4, lineHeight: 1.5 }}>
                Seller yahan buyer requests accept ya reject karega. Accepted request negotiation room bana degi.
              </div>
            </div>
            {pendingCount > 0 && (
              <div style={{
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 10,
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}>
                <i className="fas fa-clock" style={{ color: "#D97706", fontSize: "1rem" }} />
                <span style={{ fontWeight: 800, fontSize: ".9rem", color: "#92400E" }}>
                  {pendingCount} awaiting response
                </span>
              </div>
            )}
          </div>

          <div style={{ padding: "1.25rem 1.5rem" }}>
            {loading ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: T.text2 }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: "1.5rem", color: T.primary }} />
                <div style={{ marginTop: 12, fontWeight: 700, fontSize: ".95rem" }}>Loading buyer requests...</div>
              </div>
            ) : requests.length === 0 ? (
              <div style={{
                padding: "2.5rem 1.25rem",
                borderRadius: 14,
                border: `1.5px dashed ${T.border}`,
                textAlign: "center",
                color: T.text2,
                fontSize: ".95rem",
              }}>
                No buyer requests yet. Once a buyer sends interest from the marketplace, requests will appear here.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
                {requests.map((request) => (
                  <RequestCard
                    key={request.request_id}
                    request={request}
                    busyKey={busyRequest}
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </CitizenLayout>
  );
};

export default SellerPortal;