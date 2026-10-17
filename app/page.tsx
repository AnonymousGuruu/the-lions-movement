"use client";

import React, { useState, useRef, useEffect, ChangeEvent, FormEvent } from "react";
import { toPng } from "html-to-image";
import { collection, addDoc, onSnapshot, query, doc, updateDoc, getDoc, where, getDocs, DocumentData, QuerySnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface MemberData {
  fullName: string;
  phoneNumber: string;
  idNumber: string;
  county: string;
  constituency: string;
  ward: string;
  party: string;
  position: string;
  id?: string;
  [key: string]: any;
}

export default function LionsMovementPlatform() {
  const cardRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<MemberData>({
    fullName: "",
    phoneNumber: "",
    idNumber: "",
    county: "",
    constituency: "",
    ward: "",
    party: "",
    position: "Volunteer",
  });
  
  const [registeredUser, setRegisteredUser] = useState<MemberData | null>(null);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [allMembers, setAllMembers] = useState<MemberData[]>([]);

  // 1. PERSISTENT SESSION RECOVERY (Targeting 'lions_members')
  useEffect(() => {
    const savedDocId = localStorage.getItem("lions_doc_id");
    if (savedDocId) {
      setCurrentDocId(savedDocId);
      
      const fetchSavedUser = async () => {
        try {
          const docRef = doc(db, "lions_members", savedDocId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setRegisteredUser(docSnap.data() as MemberData);
          } else {
            localStorage.removeItem("lions_doc_id");
            setCurrentDocId(null);
          }
        } catch (error) {
          console.error("Error restoring persistent session:", error);
        }
      };
      
      fetchSavedUser();
    }
  }, []);

  // 2. LIVE STREAM ADMIN DATA (Fetches from 'lions_members')
  useEffect(() => {
    if (!isAdmin) return;
    
    const q = query(collection(db, "lions_members"));
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const membersData: MemberData[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      } as MemberData));

      // Safe in-memory sorting by creation timestamp
      membersData.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });

      setAllMembers(membersData);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 3. SUBMISSION HANDLER (Saves to 'lions_members')
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phoneNumber || !formData.idNumber || !formData.county || !formData.constituency || !formData.ward || !formData.party || !formData.position) return;
    
    setIsSubmitting(true);
    try {
      let targetDocId: string | null = currentDocId;

      if (!targetDocId) {
        const q = query(collection(db, "lions_members"), where("idNumber", "==", formData.idNumber.trim()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          targetDocId = querySnapshot.docs[0].id;
          setCurrentDocId(targetDocId);
          localStorage.setItem("lions_doc_id", targetDocId);
        }
      }

      if (targetDocId) {
        await updateDoc(doc(db, "lions_members", targetDocId), {
          ...formData,
          timestamp: new Date()
        });
      } else {
        const docRef = await addDoc(collection(db, "lions_members"), {
          ...formData,
          timestamp: new Date()
        });
        setCurrentDocId(docRef.id);
        localStorage.setItem("lions_doc_id", docRef.id);
      }
      
      setRegisteredUser(formData);
    } catch (error) {
      console.error("Error saving to database:", error);
      alert("Registration failed. Please check your network or database rules.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      const password = window.prompt("Enter Administrator Password:");
      if (password === "Lions2026") {
        setIsAdmin(true);
      } else if (password !== null) {
        alert("Access Denied: Incorrect Password.");
      }
    }
  };

  const handleEditCard = () => {
    if (registeredUser) {
      setFormData(registeredUser);
    }
    setRegisteredUser(null);
  };

  const handleResetForm = () => {
    localStorage.removeItem("lions_doc_id");
    setCurrentDocId(null);
    setFormData({
      fullName: "",
      phoneNumber: "",
      idNumber: "",
      county: "",
      constituency: "",
      ward: "",
      party: "",
      position: "Volunteer",
    });
    setRegisteredUser(null);
  };

  const handleDownloadCard = async () => {
    if (!cardRef.current || !registeredUser) return;
    setIsDownloading(true);
    
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `LionsMovement_Member_${registeredUser.idNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to download card:", error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* HEADER BANNER */}
      <header className="bg-slate-950 text-white shadow-md sticky top-0 z-50 border-b-2 border-[#D97706]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src="/logo.jpg" alt="The Lions Movement Logo" className="h-10 w-10 shrink-0 object-contain rounded-full border border-[#D97706] bg-black" />
            <div>
              <span className="font-black text-xl tracking-tight uppercase block leading-none text-amber-500">THE LIONS MOVEMENT</span>
              <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase hidden sm:block">The Fearless Trailblazers</span>
            </div>
          </div>
          <Button onClick={handleAdminToggle} className="bg-[#D97706] hover:bg-amber-600 text-slate-950 font-black transition border border-amber-400 text-sm">
            {isAdmin ? "Exit Dashboard" : "Admin Login"}
          </Button>
        </div>
      </header>

      {isAdmin ? (
        /* ADMIN DASHBOARD VIEW */
        <main className="max-w-7xl mx-auto px-6 py-12">
          <Card className="shadow-lg border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center space-x-4 space-y-0">
              <img src="/logo.jpg" alt="Logo" className="h-14 w-14 shrink-0 object-contain rounded-full bg-black p-0.5 border-2 border-[#D97706]" />
              <div>
                <CardTitle className="text-3xl font-black text-slate-900 tracking-tight">TRAILBLAZERS REGISTRY DATABASE</CardTitle>
                <CardDescription>Live database tracking for verified members of The Lions Movement.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-slate-200 overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700">Full Name</TableHead>
                      <TableHead className="font-bold text-slate-700">Phone</TableHead>
                      <TableHead className="font-bold text-slate-700">ID Number</TableHead>
                      <TableHead className="font-bold text-slate-700">County</TableHead>
                      <TableHead className="font-bold text-slate-700">Constituency</TableHead>
                      <TableHead className="font-bold text-slate-700">Ward</TableHead>
                      <TableHead className="font-bold text-slate-700">Party</TableHead>
                      <TableHead className="font-bold text-slate-700">Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-500 py-6">No members registered yet.</TableCell>
                      </TableRow>
                    ) : (
                      allMembers.map((member: MemberData) => (
                        <TableRow key={member.id} className="hover:bg-slate-50 transition">
                          <TableCell className="font-semibold text-slate-900">{member.fullName}</TableCell>
                          <TableCell className="text-slate-600">{member.phoneNumber}</TableCell>
                          <TableCell className="text-slate-600 font-mono">{member.idNumber}</TableCell>
                          <TableCell>
                            <span className="bg-amber-50 text-amber-900 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
                              {member.county}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600">{member.constituency}</TableCell>
                          <TableCell className="text-slate-600">{member.ward}</TableCell>
                          <TableCell className="text-slate-600 font-semibold">{member.party || "N/A"}</TableCell>
                          <TableCell>
                            <span className="bg-slate-100 text-slate-900 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200">
                              {member.position || "Volunteer"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      ) : (
        /* PUBLIC PORTAL VIEW */
        <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* VALUE PROPOSITION & MOVEMENT PRINCIPLES */}
          <section className="lg:col-span-7 space-y-8">
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-4">
                <img src="/logo.jpg" alt="The Lions Movement Logo" className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 object-contain rounded-full bg-black shadow-xl border-2 border-[#D97706]" />
                <div>
                  <div className="mb-2 sm:mb-0">
                    <span className="bg-[#D97706] text-slate-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      The Fearless Trailblazers
                    </span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-none mt-1 sm:mt-2">
                    THE LIONS <br />
                    <span className="text-[#D97706]">MOVEMENT</span>
                  </h1>
                </div>
              </div>
              
              <div className="border-l-4 border-amber-600 pl-4">
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">"THE PEOPLE. THE VOICE. THE FUTURE."</p>
                <p className="text-base sm:text-lg font-bold text-amber-700 italic">Courage, Discipline, and Service for Kenya</p>
              </div>
            </div>

            <p className="text-lg text-slate-600 leading-relaxed">
              <strong className="text-slate-900">The Lions Movement</strong> belongs to the people. We believe that leadership is a responsibility, not a privilege; public office is a platform for service, not personal enrichment; and every Kenyan deserves a voice in the decisions that shape our country.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-l-4 border-l-[#D97706] shadow-sm bg-white">
                <CardHeader className="pb-2"><CardTitle className="text-lg font-bold text-slate-900">Our Vision</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600 leading-relaxed">
                  To build a just, democratic, inclusive and prosperous Kenya where every citizen has a voice, equal opportunities and the freedom to participate in shaping the nation’s future.
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-slate-900 shadow-sm bg-white">
                <CardHeader className="pb-2"><CardTitle className="text-lg font-bold text-slate-900">Our Mission</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600 leading-relaxed">
                  To mobilize, empower and unite Kenyans, particularly the youth and women, through democratic participation, civic education, accountable leadership and people-centered development.
                </CardContent>
              </Card>
            </div>

            <Card className="border-t-4 border-t-[#D97706] shadow-md bg-white">
              <CardHeader><CardTitle className="text-xl font-bold text-slate-900">Our Guiding Principles</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold uppercase tracking-wide text-slate-700">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">Democracy & Constitutionalism</div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">Integrity & Accountability</div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">Inclusion & Equal Opportunity</div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">Servant Leadership</div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">Justice & Fairness</div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">National Unity & Patriotism</div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">Innovation & Sustainability</div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">Courage & Discipline</div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* REGISTRATION & DIGITAL CARD MODULE */}
          <section className="lg:col-span-5">
            {!registeredUser ? (
              <Card className="shadow-xl border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">{currentDocId ? "Update Member Profile" : "Official Membership Enlistment"}</CardTitle>
                  <CardDescription>
                    {currentDocId ? "Modify your details below to update your digital card." : "Join the fearless trailblazers and claim your digital credential instantly."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-xs font-bold uppercase text-slate-600">Full Official Name</Label>
                      <Input 
                        id="fullName" name="fullName" required value={formData.fullName} onChange={handleInputChange} 
                        placeholder="e.g., Wanjiru Githinji" 
                        className="text-slate-900 placeholder:text-slate-400 bg-slate-50 border-slate-200" 
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber" className="text-xs font-bold uppercase text-slate-600">Phone Number</Label>
                        <Input 
                          type="tel" id="phoneNumber" name="phoneNumber" required value={formData.phoneNumber} onChange={handleInputChange} 
                          placeholder="0712345678" 
                          className="text-slate-900 placeholder:text-slate-400 bg-slate-50 border-slate-200" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="idNumber" className="text-xs font-bold uppercase text-slate-600">National ID</Label>
                        <Input 
                          id="idNumber" name="idNumber" required value={formData.idNumber} onChange={handleInputChange} 
                          placeholder="12345678" 
                          className="text-slate-900 placeholder:text-slate-400 bg-slate-50 border-slate-200" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="county" className="text-xs font-bold uppercase text-slate-600">County of Mobilization</Label>
                      <select 
                        id="county" name="county" required value={formData.county} onChange={handleInputChange} 
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                      >
                        <option value="" className="text-slate-500">Select County</option>
                        <option value="Nairobi">Nairobi</option>
                        <option value="Mombasa">Mombasa</option>
                        <option value="Kisii">Kisii</option>
                        <option value="Kiambu">Kiambu</option>
                        <option value="Nakuru">Nakuru</option>
                        <option value="Nyeri">Nyeri</option>
                        <option value="Uasin Gishu">Uasin Gishu</option>
                        <option value="Kisumu">Kisumu</option>
                        <option value="Meru">Meru</option>
                        <option value="Machakos">Machakos</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="constituency" className="text-xs font-bold uppercase text-slate-600">Constituency</Label>
                        <Input 
                          id="constituency" name="constituency" required value={formData.constituency} onChange={handleInputChange} 
                          placeholder="e.g., Westlands" 
                          className="text-slate-900 placeholder:text-slate-400 bg-slate-50 border-slate-200" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ward" className="text-xs font-bold uppercase text-slate-600">Ward</Label>
                        <Input 
                          id="ward" name="ward" required value={formData.ward} onChange={handleInputChange} 
                          placeholder="e.g., Kangemi" 
                          className="text-slate-900 placeholder:text-slate-400 bg-slate-50 border-slate-200" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="party" className="text-xs font-bold uppercase text-slate-600">Party</Label>
                        <Input 
                          id="party" name="party" required value={formData.party} onChange={handleInputChange} 
                          placeholder="e.g., Party Name" 
                          className="text-slate-900 placeholder:text-slate-400 bg-slate-50 border-slate-200" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="position" className="text-xs font-bold uppercase text-slate-600">Position</Label>
                        <select 
                          id="position" name="position" required value={formData.position} onChange={handleInputChange} 
                          className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                        >
                          <option value="Aspirant">Aspirant</option>
                          <option value="Mobilzer">Mobilzer</option>
                          <option value="Volunteer">Volunteer</option>
                        </select>
                      </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="w-full bg-[#D97706] hover:bg-amber-600 text-slate-950 font-black py-5 rounded transition tracking-wide uppercase mt-4 shadow-lg">
                      {isSubmitting ? "Processing..." : currentDocId ? "Update & Regenerate Card" : "Register & Issue Digital Card"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              /* LIONS MOVEMENT DIGITAL MEMBERSHIP CARD */
              <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-lg text-center font-semibold text-sm shadow-sm">
                  ✓ Official Trailblazer Credentials Verified!
                </div>

                <div ref={cardRef} className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 text-white rounded-2xl shadow-2xl relative overflow-hidden border-2 border-[#D97706] aspect-[1.586/1] w-full">
                  
                  {/* Decorative Geometric Accent */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-[#D97706] opacity-15 rounded-full transform translate-x-12 -translate-y-12 pointer-events-none"></div>

                  {/* HEADER BRANDING */}
                  <div className="absolute top-5 left-6">
                    <p className="text-[10px] sm:text-xs tracking-widest uppercase text-[#D97706] font-black">THE LIONS MOVEMENT</p>
                    <h4 className="text-2xl sm:text-3xl font-black tracking-tight leading-none mt-1 text-white">TRAILBLAZER</h4>
                  </div>

                  {/* IDENTIFICATION BLOCK */}
                  <div className="absolute top-5 right-5 flex flex-col items-end space-y-2 z-10">
                    <span className="bg-[#D97706] text-slate-950 text-[10px] sm:text-xs font-black px-3 py-1 rounded uppercase tracking-wider border border-amber-300">{registeredUser.position || "Volunteer"}</span>
                  </div>

                  {/* DEMOGRAPHIC VARIABLES */}
                  <div className="absolute top-[42%] left-6 right-6 space-y-3 sm:space-y-4">
                    <div>
                      <p className="text-[9px] sm:text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Name</p>
                      <p className="text-lg sm:text-2xl font-bold tracking-wide uppercase leading-tight truncate">{registeredUser.fullName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] sm:text-[10px] text-amber-400 uppercase tracking-wider font-semibold">ID Number</p>
                        <p className="text-sm sm:text-base font-mono font-bold tracking-wider">{registeredUser.idNumber}</p>
                      </div>
                      <div>
                        <p className="text-[9px] sm:text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Location</p>
                        <p className="text-[11px] sm:text-xs font-bold tracking-wide leading-tight">{registeredUser.county} <br/> <span className="text-slate-300 font-normal">{registeredUser.constituency}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* MOTTO BLOCK */}
                  <div className="absolute bottom-5 left-6">
                    <p className="text-[8px] sm:text-[10px] tracking-tight font-black text-[#D97706] uppercase italic">
                      "THE PEOPLE. THE VOICE. THE FUTURE."
                    </p>
                  </div>

                  {/* AUTHENTICATION STAMP */}
                  <div className="absolute bottom-4 right-5 flex items-center justify-center">
                    <img src="/logo.jpg" alt="Card Stamp" className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-full bg-black border border-[#D97706] p-0.5 shadow-md shadow-black/40" />
                  </div>
                  
                </div>

                {/* POST RECRUITMENT ACTIONS */}
                <div className="space-y-3">
                  <Button onClick={handleDownloadCard} disabled={isDownloading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-5 rounded shadow uppercase tracking-wide text-sm border border-slate-700">
                    {isDownloading ? "Generating File..." : "⬇ Download Digital Membership Card"}
                  </Button>

                  <Button onClick={handleEditCard} className="w-full bg-amber-600 hover:bg-amber-700 text-slate-950 font-black py-5 rounded shadow uppercase tracking-wide text-sm border-b-2 border-amber-900">
                    ✏️ Edit My Details
                  </Button>
                  
                  <div className="text-center pt-2">
                    <button onClick={handleResetForm} className="text-sm font-bold text-slate-600 hover:text-[#D97706] underline transition">
                      ← Enlist Another Representative
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}