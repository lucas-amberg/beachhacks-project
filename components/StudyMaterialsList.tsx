"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import { StudyMaterial } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type StorageFile = {
    name: string;
    id: string;
    created_at: string;
    type: string;
};

export default function StudyMaterialsList() {
    const [studyMaterials, setStudyMaterials] = useState<StorageFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStudyMaterials = async () => {
            try {
                setIsLoading(true);
                const { data: dbMaterials, error: dbError } = await supabase
                    .from("study_materials")
                    .select(
                        `
            id,
            created_at,
            study_set
          `,
                    )
                    .order("created_at", { ascending: false });

                if (dbError) {
                    throw dbError;
                }

                const materials: StorageFile[] = [];

                for (const material of dbMaterials) {
                    const { data: storageData, error: storageError } =
                        await supabase.storage
                            .from("study-materials")
                            .list(material.id, {
                                limit: 1,
                                sortBy: { column: "name", order: "asc" },
                            });

                    if (storageError) {
                        console.error(
                            "Error getting files for material",
                            material.id,
                            storageError,
                        );
                        continue;
                    }

                    if (storageData && storageData.length > 0) {
                        const file = storageData[0];
                        materials.push({
                            name: file.name,
                            id: material.id,
                            created_at: material.created_at,
                            type: file.name.split(".").pop() || "",
                        });
                    }
                }

                setStudyMaterials(materials);
            } catch (error) {
                console.error("Error fetching study materials:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStudyMaterials();

        const channel = supabase
            .channel("study_materials_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "study_materials",
                },
                () => {
                    fetchStudyMaterials();
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const getDownloadUrl = async (id: string, filename: string) => {
        const { data } = await supabase.storage
            .from("study-materials")
            .getPublicUrl(`${id}/${filename}`);

        return data.publicUrl;
    };

    const handleDownload = async (material: StorageFile) => {
        const url = await getDownloadUrl(material.id, material.name);
        window.open(url, "_blank");
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Your Study Materials</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center items-center h-40">
                        <p>Loading study materials...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your Study Materials</CardTitle>
            </CardHeader>
            <CardContent>
                {studyMaterials.length === 0 ? (
                    <div className="flex justify-center items-center h-40">
                        <p>No study materials found. Upload your first file!</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Filename</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Uploaded At</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {studyMaterials.map((material) => (
                                <TableRow key={material.id}>
                                    <TableCell className="font-medium">
                                        {material.name}
                                    </TableCell>
                                    <TableCell className="uppercase">
                                        {material.type}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(
                                            material.created_at,
                                        ).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <button
                                            className="text-blue-500 hover:text-blue-700 underline"
                                            onClick={() =>
                                                handleDownload(material)
                                            }>
                                            Download
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
