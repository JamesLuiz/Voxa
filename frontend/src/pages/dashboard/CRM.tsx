import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCustomers, createCustomer } from "@/lib/api";

const CRM = () => {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["customers", q],
    queryFn: () => listCustomers(q ? { q } : undefined),
  });

  const mutation = useMutation({
    mutationFn: () => createCustomer({ name: newCustomer.name, email: newCustomer.email, phone: newCustomer.phone }),
    onSuccess: () => {
      setNewCustomer({ name: "", email: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-4 sm:px-0">
      <div className="flex flex-col gap-3">
        <Input 
          placeholder="Search customers" 
          value={q} 
          onChange={(e) => setQ(e.target.value)}
          className="w-full"
        />
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Input 
            placeholder="Name" 
            value={newCustomer.name} 
            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
            className="w-full"
          />
          <Input 
            placeholder="Email" 
            value={newCustomer.email} 
            onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
            className="w-full"
          />
          <Input 
            placeholder="Phone" 
            value={newCustomer.phone} 
            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
            className="w-full"
          />
          <Button 
            onClick={() => mutation.mutate()} 
            disabled={mutation.isPending || !newCustomer.name}
            className="w-full sm:w-auto whitespace-nowrap"
          >
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items || data || []).map((c: any) => (
            <Card key={c.id} className="glass">
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <span className="text-base sm:text-lg break-words">{c.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{c.lastContact ? new Date(c.lastContact).toLocaleDateString() : ""}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {c.email && <div className="break-words">Email: {c.email}</div>}
                {c.phone && <div className="break-words">Phone: {c.phone}</div>}
                {c.tags?.length ? <div className="break-words">Tags: {c.tags.join(", ")}</div> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CRM;