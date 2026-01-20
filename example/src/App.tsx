import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type User = {
  _id: Id<"users">;
  name: string;
  email: string;
  hasSsn: boolean;
  hasCreditCard: boolean;
};

type EncryptedData = {
  ref: string;
  ownerId: string;
  ciphertext: string;
  encryptedDek: string;
  iv: string;
  algorithm: string;
  version: number;
  createdAt: number;
};

export default function App() {
  const users = useQuery(api.users.list) as User[] | undefined;
  const createUser = useMutation(api.users.create);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [encryptedView, setEncryptedView] = useState<{
    userId: Id<"users">;
    ref: string;
    fieldName: string;
  } | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    await createUser({ name: newName, email: newEmail });
    setNewName("");
    setNewEmail("");
  };

  // Get encrypted data if we're viewing it
  const encryptedDataQuery = useQuery(
    api.users.getRawEncryptedData,
    encryptedView ? { userId: encryptedView.userId, ref: encryptedView.ref } : "skip"
  ) as EncryptedData | null | undefined;

  return (
    <div>
      <h1>Encrypted PII Demo</h1>

      <div className="info">
        <strong>How it works:</strong> This demo shows field-level encryption for PII data.
        Each "user" represents a data owner. Their SSN and credit card are encrypted with
        keys unique to that user. The <code>ownerId</code> in a real app would come from
        your authentication system (e.g., <code>ctx.auth.userId</code>).
      </div>

      {/* Create User Form */}
      <div className="card">
        <h2>Create User (Data Owner)</h2>
        <form onSubmit={handleCreateUser}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <button type="submit">Create User</button>
        </form>
      </div>

      {/* Users List */}
      <h2>Users</h2>
      {users?.length === 0 && (
        <div className="card">
          <p>No users yet. Create one above!</p>
        </div>
      )}

      {users?.map((user) => (
        <UserCard
          key={user._id}
          user={user}
          onViewEncrypted={(ref, fieldName) => setEncryptedView({ userId: user._id, ref, fieldName })}
        />
      ))}

      {/* Encrypted vs Decrypted Comparison */}
      {encryptedView && encryptedDataQuery && (
        <div className="card" style={{ background: "#1a1a2e", color: "#eee" }}>
          <h2 style={{ color: "#00ff88" }}>Encrypted vs Decrypted: {encryptedView.fieldName}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "1rem" }}>
            {/* Encrypted Side */}
            <div>
              <h3 style={{ color: "#ff6b6b" }}>Encrypted (What's Stored)</h3>

              <div className="form-group">
                <label style={{ color: "#888" }}>Reference ID:</label>
                <div className="pii-value" style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>
                  {encryptedDataQuery.ref}
                </div>
              </div>

              <div className="form-group">
                <label style={{ color: "#888" }}>Ciphertext (AES-256-GCM):</label>
                <div className="pii-value" style={{ fontSize: "0.7rem", wordBreak: "break-all", maxHeight: "100px", overflow: "auto" }}>
                  {encryptedDataQuery.ciphertext}
                </div>
              </div>

              <div className="form-group">
                <label style={{ color: "#888" }}>Initialization Vector (IV):</label>
                <div className="pii-value" style={{ fontSize: "0.8rem" }}>
                  {encryptedDataQuery.iv}
                </div>
              </div>

              <div className="form-group">
                <label style={{ color: "#888" }}>Encrypted DEK (wrapped with user KEK):</label>
                <div className="pii-value" style={{ fontSize: "0.7rem", wordBreak: "break-all", maxHeight: "80px", overflow: "auto" }}>
                  {encryptedDataQuery.encryptedDek}
                </div>
              </div>

              <div className="form-group">
                <label style={{ color: "#888" }}>Algorithm:</label>
                <div className="pii-value">{encryptedDataQuery.algorithm}</div>
              </div>
            </div>

            {/* Decrypted Side */}
            <div>
              <h3 style={{ color: "#00ff88" }}>Decrypted (Original Value)</h3>

              <DecryptedValue
                userId={encryptedView.userId}
                fieldName={encryptedView.fieldName}
              />

              <div style={{ marginTop: "2rem", padding: "1rem", background: "#2a2a4e", borderRadius: "8px" }}>
                <h4 style={{ color: "#ffd93d", marginBottom: "0.5rem" }}>Key Hierarchy:</h4>
                <pre style={{ fontSize: "0.75rem", color: "#aaa", margin: 0 }}>
{`Master Key
    └── User KEK (per-user)
            └── Field DEK (per-field)
                    └── Your Data`}
                </pre>
              </div>
            </div>
          </div>

          <button
            onClick={() => setEncryptedView(null)}
            style={{ marginTop: "1rem" }}
            className="secondary"
          >
            Close
          </button>
        </div>
      )}

      {/* Architecture Info */}
      <div className="card">
        <h2>Architecture</h2>
        <pre style={{
          background: "#f8f9fa",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
          fontSize: "0.85rem"
        }}>
{`Master Key (1 per component)
    └── User KEK (1 per user)
            └── Field DEK (1 per value)
                    └── Encrypted Value

• Each user has their own Key Encryption Key (KEK)
• Each field has its own Data Encryption Key (DEK)
• DEKs are encrypted with the user's KEK
• Only the owning user can decrypt their data
• GDPR compliant: deleteAllUserData removes everything`}
        </pre>
      </div>
    </div>
  );
}

// Separate component for each user card with its own state
function UserCard({
  user,
  onViewEncrypted,
}: {
  user: User;
  onViewEncrypted: (ref: string, fieldName: string) => void;
}) {
  const storeSsn = useMutation(api.users.storeSsn);
  const storeCreditCard = useMutation(api.users.storeCreditCard);
  const getDecryptedPii = useMutation(api.users.getDecryptedPii);
  const deleteUser = useMutation(api.users.deleteUser);

  // Each card has its own input state
  const [ssnInput, setSsnInput] = useState("");
  const [creditCardInput, setCreditCardInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [decryptedData, setDecryptedData] = useState<{
    ssn: string | null;
    creditCard: string | null;
  } | null>(null);

  // Get raw refs for this specific user
  const rawRefs = useQuery(api.users.getRawRefs, { userId: user._id });

  const handleStoreSsn = async () => {
    if (!ssnInput) return;
    setLoading(true);
    await storeSsn({ userId: user._id, ssn: ssnInput });
    setSsnInput("");
    setLoading(false);
  };

  const handleStoreCreditCard = async () => {
    if (!creditCardInput) return;
    setLoading(true);
    await storeCreditCard({ userId: user._id, creditCard: creditCardInput });
    setCreditCardInput("");
    setLoading(false);
  };

  const handleDecrypt = async () => {
    setLoading(true);
    const data = await getDecryptedPii({ userId: user._id });
    if (data) {
      setDecryptedData({ ssn: data.ssn, creditCard: data.creditCard });
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this user and ALL their encrypted PII?")) return;
    setLoading(true);
    const result = await deleteUser({ userId: user._id });
    alert(`Deleted user and ${result.piiFieldsDeleted} encrypted PII fields`);
    setLoading(false);
  };

  return (
    <div className="card user-card">
      <h3>
        {user.name}
        {user.hasSsn && <span className="pii-badge">SSN Stored</span>}
        {user.hasCreditCard && <span className="pii-badge">CC Stored</span>}
      </h3>
      <p>{user.email}</p>
      <p style={{ fontSize: "0.8rem", color: "#666" }}>
        Owner ID: <code>{user._id}</code>
      </p>

      {/* Store SSN */}
      <div className="form-group">
        <label>Store Encrypted SSN</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={ssnInput}
            onChange={(e) => setSsnInput(e.target.value)}
            placeholder="123-45-6789"
            style={{ flex: 1 }}
          />
          <button
            onClick={handleStoreSsn}
            disabled={loading || !ssnInput}
          >
            Encrypt & Store
          </button>
        </div>
      </div>

      {/* Store Credit Card */}
      <div className="form-group">
        <label>Store Encrypted Credit Card</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={creditCardInput}
            onChange={(e) => setCreditCardInput(e.target.value)}
            placeholder="4111-1111-1111-1111"
            style={{ flex: 1 }}
          />
          <button
            onClick={handleStoreCreditCard}
            disabled={loading || !creditCardInput}
          >
            Encrypt & Store
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={handleDecrypt}
          disabled={loading || (!user.hasSsn && !user.hasCreditCard)}
        >
          Decrypt PII
        </button>
        <button
          className="danger"
          onClick={handleDelete}
          disabled={loading}
        >
          Delete User & PII
        </button>
      </div>

      {/* Decrypted Data */}
      {decryptedData && (
        <div style={{ marginTop: "1rem" }}>
          <div className="info warning">
            <strong>Decrypted PII:</strong>
            {decryptedData.ssn && (
              <div className="pii-value">SSN: {decryptedData.ssn}</div>
            )}
            {decryptedData.creditCard && (
              <div className="pii-value">
                Credit Card: {decryptedData.creditCard}
              </div>
            )}
            {!decryptedData.ssn && !decryptedData.creditCard && (
              <div className="pii-value">No PII stored</div>
            )}
          </div>
        </div>
      )}

      {/* What's Actually Stored - always show this section for debugging */}
      <div style={{ marginTop: "1rem", padding: "1rem", background: "#f0f0f0", borderRadius: "8px" }}>
        <strong>What's Actually Stored in Database:</strong>

        {!rawRefs && (
          <p style={{ fontSize: "0.85rem", color: "#666" }}>Loading...</p>
        )}

        {rawRefs && !rawRefs.ssnRef && !rawRefs.creditCardRef && (
          <p style={{ fontSize: "0.85rem", color: "#666" }}>
            No encrypted data yet. Store an SSN or credit card above.
          </p>
        )}

        {rawRefs && (rawRefs.ssnRef || rawRefs.creditCardRef) && (
          <>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
              Click a reference to see the encrypted vs decrypted comparison
            </p>

            {rawRefs.ssnRef && (
              <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.8rem" }}>SSN Reference (opaque string stored in users table):</label>
                <div
                  className="pii-value"
                  style={{ cursor: "pointer", wordBreak: "break-all", fontSize: "0.75rem" }}
                  onClick={() => onViewEncrypted(rawRefs.ssnRef!, "SSN")}
                >
                  {rawRefs.ssnRef}
                </div>
              </div>
            )}

            {rawRefs.creditCardRef && (
              <div className="form-group">
                <label style={{ fontSize: "0.8rem" }}>Credit Card Reference (opaque string stored in users table):</label>
                <div
                  className="pii-value"
                  style={{ cursor: "pointer", wordBreak: "break-all", fontSize: "0.75rem" }}
                  onClick={() => onViewEncrypted(rawRefs.creditCardRef!, "Credit Card")}
                >
                  {rawRefs.creditCardRef}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Separate component to fetch decrypted value
function DecryptedValue({ userId, fieldName }: { userId: Id<"users">; fieldName: string }) {
  const getDecryptedPii = useMutation(api.users.getDecryptedPii);
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDecryptedPii({ userId }).then((data) => {
      if (data) {
        setValue(fieldName === "SSN" ? data.ssn : data.creditCard);
      }
      setLoading(false);
    });
  }, [userId, fieldName]);

  if (loading) {
    return <div className="pii-value">Decrypting...</div>;
  }

  return (
    <div className="form-group">
      <label style={{ color: "#888" }}>Decrypted Value:</label>
      <div className="pii-value" style={{
        fontSize: "1.5rem",
        fontWeight: "bold",
        background: "#00ff8822",
        border: "2px solid #00ff88"
      }}>
        {value ?? "Not found"}
      </div>
    </div>
  );
}
