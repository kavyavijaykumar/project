import React, { useState } from "react";
import { api } from "../../api";

function Upload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (err) {
      alert("Error uploading image.");
    }
  };

  return (
    <div>
      <h2>Upload Image for Detection</h2>
      <input type="file" onChange={handleFileChange} accept="image/*" />
      <button onClick={handleUpload}>Analyze</button>

      {preview && <img src={preview} alt="Preview" width="400" style={{ marginTop: "20px" }} />}
      {result && (
        <div style={{ marginTop: "20px" }}>
          <h4>Detected Labels:</h4>
          <ul>
            {result.labels.map((label, i) => (
              <li key={i}>{label}</li>
            ))}
          </ul>
          <img
            src={`data:image/jpeg;base64,${result.image}`}
            alt="Result"
            width="400"
            style={{ borderRadius: "10px", marginTop: "15px" }}
          />
        </div>
      )}
    </div>
  );
}

export default Upload;
