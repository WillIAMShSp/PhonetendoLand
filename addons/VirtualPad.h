#pragma once

#include <napi.h>


class VirtualPad : public Napi::ObjectWrap<VirtualPad>
{
public:
    VirtualPad(const Napi::CallbackInfo& info);
    
    Napi::Value test(const Napi::CallbackInfo& info);


    static Napi::Function GetClass(Napi::Env env);

private:
    
    uint32_t playerId;

};

void throwError(Napi::Env& env, const char* message);

