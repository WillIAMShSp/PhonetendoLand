/**
 * @file VirtualPad.h
 * @author Luis Camilo Alvarez Carrau
 * @brief Class definition for a virtual game pad.
 * @version 0.1
 * @date 2026-07-18
 */

#pragma once

#define WIN32_LEAN_AND_MEAN  
#include <windows.h>

#include <iostream>
#include <string>
#include <thread>
#include <atomic>
#include <queue>
#include <mutex>


#include <napi.h>
#include <ViGEm/Client.h>

#pragma comment(lib, "setupapi.lib")

struct ControllerInput {

    USHORT buttonMask;
    bool pressState;

};

struct RumbleHookRef {
    RumbleHookRef() = default;
    RumbleHookRef(napi_ref& ref, uint32_t& refCount, Napi::Env& env) :hook(ref), refCount(refCount), env(env){}
    napi_ref hook;
    uint32_t refCount;
    Napi::Env env = nullptr;
};

VOID CALLBACK RumbleCallback(PVIGEM_CLIENT Client, PVIGEM_TARGET Target, UCHAR LargeMotor, UCHAR SmallMotor, UCHAR LedNumber, LPVOID UserData) {
   
    RumbleHookRef ref = *(RumbleHookRef*)UserData;

    napi_value funcval;
    napi_get_reference_value(ref.env, ref.hook, &funcval);
    
    Napi::Value napiFuncVal = Napi::Value(ref.env, funcval);

    Napi::Function func = napiFuncVal.As<Napi::Function>();

    func.Call({});


    // rumbleHook->Call({});
}

class VirtualPad : public Napi::ObjectWrap<VirtualPad>
{
public:
    VirtualPad(const Napi::CallbackInfo& info);
    ~VirtualPad();

    Napi::Value test(const Napi::CallbackInfo& info);
    Napi::Value startController(const Napi::CallbackInfo& info);
    Napi::Value sendInput(const Napi::CallbackInfo& info);
    Napi::Value endController(const Napi::CallbackInfo& info);

    static Napi::Function GetClass(Napi::Env env);
    

    std::atomic<bool>& getPadActive();
    std::thread& getPadThread();


private:
    
    std::string playerId;
    std::thread m_thread;
    std::atomic<bool> g_padActive;
    std::queue<ControllerInput> g_controllerInputQueue;
    std::mutex g_mutex;

    void injectInput(ControllerInput input);

    PVIGEM_CLIENT m_client;
    PVIGEM_TARGET m_pad;

    USHORT g_buttonStates = 0;
    void inputPollLoop();

    
    RumbleHookRef m_rumbleHookRef;

    Napi::Value m_rumbleFuncVal;

    
    void testFunc(Napi::Env& env, napi_handle_scope scope, Napi::Function& function) {

        Napi::HandleScope(env, scope);
        function.Call({});

    }
    


};

void throwError(Napi::Env& env, const char* message);

void TestThreaded(std::atomic<bool>& active);

