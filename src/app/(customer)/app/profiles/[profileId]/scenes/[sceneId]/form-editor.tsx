"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, inputClass } from "@/components/ui/input";
import { FIELD_LABELS, FORM_FIELDS, MAX_QUESTIONS, type FormConfig } from "@/modules/forms/config";
import { updateFormAction } from "./actions";

export function FormEditor({ profileId, sceneId, form }: { profileId: string; sceneId: string; form: { id: string; title: string; config: FormConfig } }) {
  const [state, action, pending] = useActionState(updateFormAction, undefined);
  const [questions, setQuestions] = useState(form.config.questions.map((question, index) => ({ ...question, key: String(index) })));
  const [nextKey, setNextKey] = useState(questions.length);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="sceneId" value={sceneId} />
      <input type="hidden" name="formId" value={form.id} />
      <label className="flex flex-col gap-1 text-sm font-medium">Form title<Input name="title" required maxLength={60} defaultValue={form.title} /></label>
      {FORM_FIELDS.map(field => field === "name" ? (
        <div key={field} className="flex min-h-11 items-center justify-between text-sm"><span>{FIELD_LABELS[field]}</span><span>Required</span><input type="hidden" name="field.name" value="required" /></div>
      ) : (
        <label key={field} className="flex flex-col gap-1 text-sm font-medium">{FIELD_LABELS[field]}
          <select name={`field.${field}`} className={inputClass} defaultValue={form.config.fields[field]}>
            <option value="hidden">Hidden</option><option value="optional">Optional</option><option value="required">Required</option>
          </select>
        </label>
      ))}
      <p className="text-sm text-muted-foreground">Make Email or Phone required so you can reply.</p>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Your questions</legend>
        {questions.map((question, index) => (
          <div key={question.key} className="flex flex-col gap-2">
            <input type="hidden" name={`question.${index}.id`} value={question.id} />
            <label className="flex flex-col gap-1 text-sm">Question {index + 1}<Input name={`question.${index}.label`} maxLength={80} defaultValue={question.label} /></label>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`question.${index}.required`} defaultChecked={question.required} />Required</label>
            <Button type="button" size="touch" variant="ghost" onClick={() => setQuestions(current => current.filter(item => item.key !== question.key))}>Remove</Button>
          </div>
        ))}
        {questions.length < MAX_QUESTIONS ? <Button type="button" size="touch" variant="outline" onClick={() => { setQuestions(current => [...current, { key: String(nextKey), id: "", label: "", required: false }]); setNextKey(nextKey + 1); }}>Add a question</Button> : null}
      </fieldset>
      {state?.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      <Button type="submit" size="touch" disabled={pending}>Save</Button>
    </form>
  );
}
